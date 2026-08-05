-- ============================================================
-- MIGRATION 054: Admin revenue dashboard enhancements (Plane #59)
-- ============================================================
-- Completes the Plane #59 spec gaps on top of migration 048:
--   1. Charts over time        -> admin_get_vendor_revenue_series()
--   2. Transaction filtering   -> admin_get_vendor_transactions() gains
--                                 status / date-range / vendor / tenant filters
--   3. Transaction drill-down  -> admin_get_vendor_transaction_detail()
--                                 (payment + ledger journal + photo evidence)
--   4. Dispute photo evidence  -> admin_get_vendor_disputes() gains an
--                                 evidence timeline (closure + progress photos)
--   5. Filter dropdown options -> admin_get_vendor_party_options()
--
-- Depends on: migrations 047, 048 (vendor_payments + admin RPCs)
-- ============================================================

-- ------------------------------------------------------------------
-- 0. Shared evidence helper: photo evidence + event timeline for a
--    maintenance request. Used by both the dispute queue and the
--    transaction drill-down so the two views never diverge.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_vendor_evidence(p_mr_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'photos', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('url', e.url, 'stage', e.stage, 'at', e.at)
        ORDER BY e.at NULLS LAST
      ), '[]'::jsonb)
      FROM (
        SELECT unnest(cr.completion_photos)          AS url, 'completion'          AS stage, cr.closed_at             AS at
          FROM closure_reports cr WHERE cr.maintenance_request_id = p_mr_id
        UNION ALL
        SELECT unnest(cr.vendor_after_photos)        AS url, 'vendor_after'        AS stage, cr.vendor_confirmed_at   AS at
          FROM closure_reports cr WHERE cr.maintenance_request_id = p_mr_id
        UNION ALL
        SELECT unnest(cr.tenant_rejection_photos)    AS url, 'tenant_rejection'    AS stage, cr.rejected_at           AS at
          FROM closure_reports cr WHERE cr.maintenance_request_id = p_mr_id
        UNION ALL
        SELECT unnest(cr.tenant_confirmation_photos) AS url, 'tenant_confirmation' AS stage, cr.tenant_ack_at         AS at
          FROM closure_reports cr WHERE cr.maintenance_request_id = p_mr_id
        UNION ALL
        SELECT unnest(jpu.photos)                    AS url, 'progress'            AS stage, jpu.created_at           AS at
          FROM job_progress_updates jpu WHERE jpu.maintenance_request_id = p_mr_id
      ) e
    ),
    'timeline', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('event', t.event, 'note', t.note, 'at', t.at)
        ORDER BY t.at NULLS LAST
      ), '[]'::jsonb)
      FROM (
        SELECT 'closure_requested' AS event, cr.vendor_closure_notes AS note, cr.vendor_confirmed_at    AS at
          FROM closure_reports cr WHERE cr.maintenance_request_id = p_mr_id AND cr.vendor_confirmed_at IS NOT NULL
        UNION ALL
        SELECT 'closure_forwarded' AS event, NULL::text             AS note, cr.forwarded_to_tenant_at  AS at
          FROM closure_reports cr WHERE cr.maintenance_request_id = p_mr_id AND cr.forwarded_to_tenant_at IS NOT NULL
        UNION ALL
        SELECT 'tenant_approved'   AS event, NULL::text             AS note, cr.tenant_ack_at           AS at
          FROM closure_reports cr WHERE cr.maintenance_request_id = p_mr_id AND cr.tenant_ack_at IS NOT NULL
        UNION ALL
        SELECT 'tenant_rejected'   AS event, cr.tenant_notes        AS note, cr.rejected_at             AS at
          FROM closure_reports cr WHERE cr.maintenance_request_id = p_mr_id AND cr.rejected_at IS NOT NULL
        UNION ALL
        SELECT 'closed'            AS event, NULL::text             AS note, cr.closed_at               AS at
          FROM closure_reports cr WHERE cr.maintenance_request_id = p_mr_id AND cr.closed_at IS NOT NULL
        UNION ALL
        SELECT 'progress'          AS event, jpu.notes              AS note, jpu.created_at             AS at
          FROM job_progress_updates jpu WHERE jpu.maintenance_request_id = p_mr_id
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.admin_vendor_evidence IS
  'Builds photo evidence + event timeline for a maintenance request, used by
   the admin dispute queue and transaction drill-down.' ;

-- ------------------------------------------------------------------
-- 1. Revenue series over time (daily buckets, net + gross)
--    NOTE: aggregation happens in a subquery first — Postgres forbids
--    nesting SUM() inside jsonb_agg(), so the daily sums are computed
--    in a derived table and only jsonb_agg wraps the final rows.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_vendor_revenue_series(p_days int DEFAULT 30)
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

  IF p_days < 1 OR p_days > 365 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 365';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object('day', d.day, 'gross', d.gross, 'net', d.net)
    ORDER BY d.day
  ) INTO result
  FROM (
    SELECT
      to_char(g.day, 'YYYY-MM-DD')                     AS day,
      COALESCE(SUM(vp.total_amount), 0)                AS gross,
      COALESCE(SUM(vp.net_revenue), 0)                 AS net
    FROM generate_series(
      date_trunc('day', now() - (p_days - 1) * interval '1 day'),
      date_trunc('day', now()),
      interval '1 day'
    ) AS g(day)
    LEFT JOIN vendor_payments vp
      ON date_trunc('day', vp.paid_at) = g.day
     AND vp.payment_status = 'completed'
    GROUP BY g.day
  ) d;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.admin_get_vendor_revenue_series IS
  'Daily gross + net revenue buckets (completed vendor payments) for the last
   p_days days, one entry per day including zero days — for the admin revenue
   chart over time. Admin only.' ;

-- ------------------------------------------------------------------
-- 2. Filtered transaction list (replaces the 048 2-arg overload)
-- ------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_get_vendor_transactions(int, text);

CREATE OR REPLACE FUNCTION public.admin_get_vendor_transactions(
  p_limit int DEFAULT 100,
  p_payment_status text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_vendor_id uuid DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL
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

  RETURN (SELECT jsonb_agg(sub.*) FROM (
    SELECT
      vp.id,
      mi.invoice_number,
      mr.title               AS maintenance_title,
      vp_vendor.full_name    AS vendor_name,
      vp_tenant.full_name    AS tenant_name,
      vp.total_amount,
      vp.platform_fee,
      vp.gateway_fee,
      vp.vendor_payout,
      vp.net_revenue,
      vp.payment_status,
      vp.payout_status,
      vp.dispute_status,
      vp.paid_at,
      vp.created_at
    FROM vendor_payments vp
    LEFT JOIN maintenance_invoices mi ON mi.id = vp.invoice_id
    LEFT JOIN maintenance_requests mr ON mr.id = vp.maintenance_request_id
    LEFT JOIN profiles vp_vendor ON vp_vendor.id = vp.vendor_id
    LEFT JOIN profiles vp_tenant ON vp_tenant.id = vp.tenant_id
    WHERE (p_payment_status IS NULL OR vp.payment_status = p_payment_status)
      AND (p_from IS NULL OR vp.created_at >= p_from)
      AND (p_to   IS NULL OR vp.created_at <= p_to)
      AND (p_vendor_id IS NULL OR vp.vendor_id = p_vendor_id)
      AND (p_tenant_id IS NULL OR vp.tenant_id = p_tenant_id)
    ORDER BY vp.created_at DESC
    LIMIT p_limit
  ) sub);
END;
$$;

COMMENT ON FUNCTION public.admin_get_vendor_transactions IS
  'Returns vendor payment transactions with optional filters: payment status,
   created-at date range, vendor id, tenant id. Admin only.' ;

-- ------------------------------------------------------------------
-- 3. Transaction drill-down (payment + ledger journal + evidence)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_vendor_transaction_detail(p_payment_id uuid)
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
    'id',                  vp.id,
    'invoice_number',      mi.invoice_number,
    'maintenance_title',   mr.title,
    'vendor_name',         vp_vendor.full_name,
    'tenant_name',         vp_tenant.full_name,
    'total_amount',        vp.total_amount,
    'platform_fee',        vp.platform_fee,
    'platform_fee_percent', vp.platform_fee_percent,
    'gateway_fee',         vp.gateway_fee,
    'payout_fee',          vp.payout_fee,
    'vendor_payout',       vp.vendor_payout,
    'net_revenue',         vp.net_revenue,
    'payment_status',      vp.payment_status,
    'payout_status',       vp.payout_status,
    'dispute_status',      vp.dispute_status,
    'payout_method',       vp.payout_method,
    'payout_reference',    vp.payout_reference,
    'payment_gateway',     vp.payment_gateway,
    'gateway_transaction_id', vp.gateway_transaction_id,
    'paid_at',             vp.paid_at,
    'payout_initiated_at', vp.payout_initiated_at,
    'payout_completed_at', vp.payout_completed_at,
    'created_at',          vp.created_at,
    'ledger', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'entry_type',    vpl.entry_type,
          'amount',        vpl.amount,
          'running_balance', vpl.running_balance,
          'description',   vpl.description,
          'created_at',    vpl.created_at
        ) ORDER BY vpl.created_at
      ), '[]'::jsonb)
      FROM vendor_payment_ledger vpl
      WHERE vpl.vendor_payment_id = vp.id
    ),
    'evidence', public.admin_vendor_evidence(vp.maintenance_request_id)
  ) INTO result
  FROM vendor_payments vp
  LEFT JOIN maintenance_invoices mi ON mi.id = vp.invoice_id
  LEFT JOIN maintenance_requests mr ON mr.id = vp.maintenance_request_id
  LEFT JOIN profiles vp_vendor ON vp_vendor.id = vp.vendor_id
  LEFT JOIN profiles vp_tenant ON vp_tenant.id = vp.tenant_id
  WHERE vp.id = p_payment_id;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.admin_get_vendor_transaction_detail IS
  'Full drill-down for a single vendor payment: joined invoice/maintenance
   parties, the immutable ledger journal, and photo evidence. Admin only.' ;

-- ------------------------------------------------------------------
-- 4. Dispute queue — add photo evidence to the 048 version
-- ------------------------------------------------------------------
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
      'created_at',        vp.created_at,
      'evidence',          public.admin_vendor_evidence(vp.maintenance_request_id)
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
  'All vendor payments with active disputes (opened/escalated) plus the photo
   evidence + event timeline for each, for the admin dispute queue. Admin only.' ;

-- ------------------------------------------------------------------
-- 5. Filter dropdown options (distinct vendors + tenants)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_vendor_party_options()
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

  RETURN jsonb_build_object(
    'vendors', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('id', v.id, 'full_name', v.full_name)
        ORDER BY v.full_name
      ), '[]'::jsonb)
      FROM (SELECT DISTINCT vp.vendor_id AS id FROM vendor_payments vp) x
      JOIN profiles v ON v.id = x.id
    ),
    'tenants', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('id', t.id, 'full_name', t.full_name)
        ORDER BY t.full_name
      ), '[]'::jsonb)
      FROM (SELECT DISTINCT vp.tenant_id AS id FROM vendor_payments vp) y
      JOIN profiles t ON t.id = y.id
    )
  );
END;
$$;

COMMENT ON FUNCTION public.admin_get_vendor_party_options IS
  'Distinct vendors and tenants referenced by vendor_payments, for admin
   transaction filter dropdowns. Admin only.' ;

-- ============================================================
-- MIGRATION 054 COMPLETE
-- ============================================================
