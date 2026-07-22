-- ============================================================
-- MIGRATION 048: Admin vendor revenue summary RPC
-- ============================================================
-- Adds an admin RPC that aggregates vendor_payments data for
-- the Phase 5 Vendor Revenue Dashboard (enhanced PaymentsPage).
--
-- Depends on: migration 047 (vendor_payments table)
-- ============================================================

-- Vendor revenue summary (admin view)
-- Returns aggregate metrics from vendor_payments for the admin revenue dashboard
CREATE OR REPLACE FUNCTION public.admin_get_vendor_revenue_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT jsonb_build_object(
    -- Gross revenue: total amount collected from completed payments
    'gross_collected',       (SELECT COALESCE(sum(total_amount), 0) FROM vendor_payments WHERE payment_status = 'completed'),

    -- Platform fees: sum of platform fee from completed payments
    'platform_fees',         (SELECT COALESCE(sum(platform_fee), 0) FROM vendor_payments WHERE payment_status = 'completed'),

    -- Gateway fees: sum of gateway fee from completed payments
    'gateway_fees',          (SELECT COALESCE(sum(gateway_fee), 0) FROM vendor_payments WHERE payment_status = 'completed'),

    -- Net revenue: platform_fee - gateway_fee (generated column)
    'net_revenue',           (SELECT COALESCE(sum(net_revenue), 0) FROM vendor_payments WHERE payment_status = 'completed'),

    -- Pending payouts: sum of vendor_payout where payment completed but payout not yet sent
    'pending_payouts_total', (SELECT COALESCE(sum(vendor_payout), 0) FROM vendor_payments WHERE payment_status = 'completed' AND payout_status IN ('pending', 'processing')),

    -- Active disputes count
    'active_disputes',       (SELECT count(*) FROM vendor_payments WHERE dispute_status IN ('opened', 'escalated')),

    -- Pending disputes count (opened but not yet escalated)
    'pending_disputes',      (SELECT count(*) FROM vendor_payments WHERE dispute_status = 'opened'),

    -- Transaction counts
    'completed_count',       (SELECT count(*) FROM vendor_payments WHERE payment_status = 'completed'),
    'pending_count',         (SELECT count(*) FROM vendor_payments WHERE payment_status = 'pending'),
    'failed_count',          (SELECT count(*) FROM vendor_payments WHERE payment_status = 'failed'),
    'total_count',           (SELECT count(*) FROM vendor_payments),

    -- Revenue over time (last 30 days)
    'revenue_30d',           (SELECT COALESCE(sum(net_revenue), 0) FROM vendor_payments WHERE payment_status = 'completed' AND paid_at >= now() - interval '30 days'),

    -- Revenue over time (last 7 days)
    'revenue_7d',            (SELECT COALESCE(sum(net_revenue), 0) FROM vendor_payments WHERE payment_status = 'completed' AND paid_at >= now() - interval '7 days')
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.admin_get_vendor_revenue_summary IS
  'Aggregates vendor_payments data for the Phase 5 admin revenue dashboard.
   Returns gross collected, platform fees, net revenue, pending payouts,
   dispute counts, and time-windowed revenue figures.';

-- ─────────────────────────────────────────────────────────
-- Recent vendor transactions (for revenue table display)
-- ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_get_vendor_transactions(
  p_limit int DEFAULT 50,
  p_payment_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN (SELECT jsonb_agg(
    jsonb_build_object(
      'id',                vp.id,
      'invoice_number',    mi.invoice_number,
      'maintenance_title', mr.title,
      'vendor_name',       vp_vendor.full_name,
      'tenant_name',       vp_tenant.full_name,
      'total_amount',      vp.total_amount,
      'platform_fee',      vp.platform_fee,
      'gateway_fee',       vp.gateway_fee,
      'vendor_payout',     vp.vendor_payout,
      'net_revenue',       vp.net_revenue,
      'payment_status',    vp.payment_status,
      'payout_status',     vp.payout_status,
      'dispute_status',    vp.dispute_status,
      'paid_at',           vp.paid_at,
      'created_at',        vp.created_at
    ) ORDER BY vp.created_at DESC
  )
  FROM vendor_payments vp
  LEFT JOIN maintenance_invoices mi ON mi.id = vp.invoice_id
  LEFT JOIN maintenance_requests mr ON mr.id = vp.maintenance_request_id
  LEFT JOIN profiles vp_vendor ON vp_vendor.id = vp.vendor_id
  LEFT JOIN profiles vp_tenant ON vp_tenant.id = vp.tenant_id
  WHERE (p_payment_status IS NULL OR vp.payment_status = p_payment_status)
  LIMIT p_limit
  );
END;
$$;

COMMENT ON FUNCTION public.admin_get_vendor_transactions IS
  'Returns recent vendor payment transactions with joined invoice, maintenance,
   vendor, and tenant details for the admin revenue table display.';

-- Active vendor disputes
CREATE OR REPLACE FUNCTION public.admin_get_vendor_disputes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN (SELECT jsonb_agg(
    jsonb_build_object(
      'id',                vp.id,
      'invoice_number',    mi.invoice_number,
      'maintenance_title', mr.title,
      'vendor_name',       vp_vendor.full_name,
      'tenant_name',       vp_tenant.full_name,
      'total_amount',      vp.total_amount,
      'vendor_payout',     vp.vendor_payout,
      'dispute_status',    vp.dispute_status,
      'payout_status',     vp.payout_status,
      'created_at',        vp.created_at
    ) ORDER BY vp.created_at DESC
  )
  FROM vendor_payments vp
  LEFT JOIN maintenance_invoices mi ON mi.id = vp.invoice_id
  LEFT JOIN maintenance_requests mr ON mr.id = vp.maintenance_request_id
  LEFT JOIN profiles vp_vendor ON vp_vendor.id = vp.vendor_id
  LEFT JOIN profiles vp_tenant ON vp_tenant.id = vp.tenant_id
  WHERE vp.dispute_status IN ('opened', 'escalated')
  );
END;
$$;

COMMENT ON FUNCTION public.admin_get_vendor_disputes IS
  'Returns all vendor payments with active disputes (opened or escalated)
   for the admin dispute management interface.';

-- Resolve or escalate a vendor payment dispute
CREATE OR REPLACE FUNCTION public.admin_resolve_vendor_dispute(
  p_payment_id uuid,
  p_action text,  -- 'resolve' or 'escalate'
  p_note text DEFAULT NULL  -- Optional resolution note for audit trail
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
DECLARE
  vp_record vendor_payments%ROWTYPE;
  new_status text;
  v_updated int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF p_action NOT IN ('resolve', 'escalate') THEN
    RAISE EXCEPTION 'Invalid action. Must be ''resolve'' or ''escalate''.';
  END IF;

  -- Fetch current state
  SELECT * INTO vp_record FROM vendor_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor payment not found';
  END IF;

  -- Only allow action on disputed payments
  IF vp_record.dispute_status NOT IN ('opened', 'escalated') THEN
    RAISE EXCEPTION 'Payment dispute status is ''%''. Only ''opened'' or ''escalated'' disputes can be managed.', vp_record.dispute_status;
  END IF;

  -- Determine new status
  IF p_action = 'resolve' THEN
    new_status := 'resolved';
  ELSE
    new_status := 'escalated';
  END IF;

  -- Atomically update with status guard (prevents concurrent double-resolve)
  WITH updated AS (
    UPDATE vendor_payments
    SET
      dispute_status = new_status,
      dispute_resolved_at = CASE WHEN p_action = 'resolve' THEN now() ELSE NULL END,
      updated_at = now()
    WHERE id = p_payment_id
      AND dispute_status IN ('opened', 'escalated')
    RETURNING id
  )
  SELECT count(*) INTO v_updated FROM updated;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Concurrent update detected or dispute already resolved. Status is now ''%''.',
      (SELECT dispute_status FROM vendor_payments WHERE id = p_payment_id);
  END IF;

  -- If resolved and payout was on_hold, reset to pending
  IF p_action = 'resolve' AND vp_record.payout_status = 'on_hold' THEN
    UPDATE vendor_payments
    SET payout_status = 'pending'
    WHERE id = p_payment_id AND payout_status = 'on_hold';
  END IF;

  -- ── Audit trail ────────────────────────────────────────────────────────
  INSERT INTO dev_function_logs (source, level, message, metadata)
  VALUES (
    'admin-payments',
    'info',
    format('Admin %s dispute on payment %s → %s', p_action, p_payment_id, new_status),
    jsonb_build_object(
      'payment_id', p_payment_id,
      'action', p_action,
      'previous_status', vp_record.dispute_status,
      'new_status', new_status,
      'note', p_note
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'previous_status', vp_record.dispute_status,
    'new_status', new_status
  );
END;
$$;

COMMENT ON FUNCTION public.admin_resolve_vendor_dispute IS
  'Allows admin to resolve or escalate a vendor payment dispute.
   Resolving sets dispute_status to ''resolved'' and releases payout hold.
   Escalating sets dispute_status to ''escalated'' for higher review.';
