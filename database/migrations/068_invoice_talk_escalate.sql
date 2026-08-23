-- MIGRATION 068: Invoice talk + LalaRente escalate (Plane #110)
-- Pre-pay disagreement only. Not rent payment-disputes. Not PayFast after money moved.

ALTER TABLE maintenance_invoices
  DROP CONSTRAINT IF EXISTS maintenance_invoices_status_check;

ALTER TABLE maintenance_invoices
  ADD CONSTRAINT maintenance_invoices_status_check
  CHECK (status = ANY (ARRAY[
    'submitted'::text,
    'approved'::text,
    'rejected'::text,
    'paid'::text,
    'cancelled'::text,
    'disputed'::text
  ]));

ALTER TABLE maintenance_invoices
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS admin_decision text,
  ADD COLUMN IF NOT EXISTS admin_decision_notes text,
  ADD COLUMN IF NOT EXISTS admin_decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_decision_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS admin_amended_amount numeric(12,2);

CREATE TABLE IF NOT EXISTS invoice_talk_confirmations (
  invoice_id uuid NOT NULL REFERENCES maintenance_invoices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (invoice_id, user_id)
);

ALTER TABLE invoice_talk_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_talk_select ON invoice_talk_confirmations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_invoices mi
      WHERE mi.id = invoice_id
        AND (
          mi.vendor_id = auth.uid()
          OR mi.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM leases l
            WHERE l.property_id = mi.property_id
              AND l.tenant_id = auth.uid()
              AND mi.payer_role = 'tenant'
              AND l.status IN ('active', 'month_to_month')
          )
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin'
          )
        )
    )
  );

CREATE POLICY invoice_talk_insert ON invoice_talk_confirmations
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM maintenance_invoices mi
      WHERE mi.id = invoice_id
        AND mi.status IN ('submitted', 'rejected')
        AND (
          mi.vendor_id = auth.uid()
          OR (mi.payer_role = 'owner' AND mi.owner_id = auth.uid())
          OR (
            mi.payer_role = 'tenant'
            AND EXISTS (
              SELECT 1 FROM leases l
              WHERE l.property_id = mi.property_id
                AND l.tenant_id = auth.uid()
                AND l.status IN ('active', 'month_to_month')
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS tenant_invoice_audit_select ON maintenance_invoice_audit_logs;
CREATE POLICY tenant_invoice_audit_select ON maintenance_invoice_audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_invoices mi
      JOIN leases l ON l.property_id = mi.property_id AND l.tenant_id = auth.uid()
      WHERE mi.id = invoice_id
        AND mi.payer_role = 'tenant'
        AND l.status IN ('active', 'month_to_month')
    )
  );

DROP POLICY IF EXISTS admin_invoice_select ON maintenance_invoices;
CREATE POLICY admin_invoice_select ON maintenance_invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE OR REPLACE FUNCTION escalate_maintenance_invoice(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv maintenance_invoices%ROWTYPE;
  confirm_count int;
  is_party boolean;
BEGIN
  SELECT * INTO inv FROM maintenance_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  is_party :=
    auth.uid() = inv.vendor_id
    OR (inv.payer_role = 'owner' AND auth.uid() = inv.owner_id)
    OR (
      inv.payer_role = 'tenant'
      AND EXISTS (
        SELECT 1 FROM leases l
        WHERE l.property_id = inv.property_id
          AND l.tenant_id = auth.uid()
          AND l.status IN ('active', 'month_to_month')
      )
    );

  IF NOT is_party THEN
    RAISE EXCEPTION 'Not authorised to escalate this invoice';
  END IF;

  IF inv.status NOT IN ('submitted', 'rejected') THEN
    RAISE EXCEPTION 'Only submitted or rejected invoices can be escalated';
  END IF;

  SELECT count(*) INTO confirm_count
  FROM invoice_talk_confirmations
  WHERE invoice_id = p_invoice_id;

  IF confirm_count < 2 THEN
    RAISE EXCEPTION 'Both sides must confirm they tried to talk first';
  END IF;

  UPDATE maintenance_invoices
  SET
    status = 'disputed',
    escalated_at = now(),
    escalated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_invoice_id
    AND status IN ('submitted', 'rejected');
END;
$$;

CREATE OR REPLACE FUNCTION resolve_maintenance_invoice_dispute(
  p_invoice_id uuid,
  p_decision text,
  p_notes text,
  p_amended_amount numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv maintenance_invoices%ROWTYPE;
  new_status text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_decision NOT IN ('uphold_vendor', 'amend_amount', 'reject') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  SELECT * INTO inv FROM maintenance_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF inv.status <> 'disputed' THEN
    RAISE EXCEPTION 'Invoice is not disputed';
  END IF;

  IF p_decision = 'uphold_vendor' THEN
    new_status := 'approved';
  ELSIF p_decision = 'amend_amount' THEN
    IF p_amended_amount IS NULL OR p_amended_amount <= 0 THEN
      RAISE EXCEPTION 'Amended amount required';
    END IF;
    new_status := 'approved';
  ELSE
    new_status := 'rejected';
  END IF;

  UPDATE maintenance_invoices
  SET
    status = new_status,
    admin_decision = p_decision,
    admin_decision_notes = p_notes,
    admin_decision_at = now(),
    admin_decision_by = auth.uid(),
    admin_amended_amount = CASE WHEN p_decision = 'amend_amount' THEN p_amended_amount ELSE NULL END,
    total_amount = CASE WHEN p_decision = 'amend_amount' THEN p_amended_amount ELSE total_amount END,
    approved_at = CASE WHEN new_status = 'approved' THEN now() ELSE approved_at END,
    approved_by = CASE WHEN new_status = 'approved' THEN auth.uid() ELSE approved_by END,
    rejected_at = CASE WHEN new_status = 'rejected' THEN now() ELSE rejected_at END,
    rejection_reason = CASE WHEN new_status = 'rejected' THEN coalesce(p_notes, rejection_reason) ELSE rejection_reason END,
    updated_at = now()
  WHERE id = p_invoice_id
    AND status = 'disputed';
END;
$$;

GRANT EXECUTE ON FUNCTION escalate_maintenance_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_maintenance_invoice_dispute(uuid, text, text, numeric) TO authenticated;

COMMENT ON FUNCTION escalate_maintenance_invoice(uuid) IS
  'Plane #110: job parties escalate a pre-pay invoice after both confirm they talked.';
COMMENT ON FUNCTION resolve_maintenance_invoice_dispute(uuid, text, text, numeric) IS
  'Plane #110: admin uphold / amend / reject a disputed invoice.';
