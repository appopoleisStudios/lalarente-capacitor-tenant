-- Plane #110 SA: disputed / admin_* / escalate_* only via SECURITY DEFINER RPCs.
-- Existing owner_invoice_update / tenant_invoice_update would otherwise PATCH status.

CREATE OR REPLACE FUNCTION protect_invoice_talk_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.invoice_talk_rpc', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'disputed' THEN
    RAISE EXCEPTION 'disputed invoices can only be resolved via resolve_maintenance_invoice_dispute';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'disputed' THEN
    RAISE EXCEPTION 'use escalate_maintenance_invoice to dispute an invoice';
  END IF;

  IF NEW.escalated_at IS DISTINCT FROM OLD.escalated_at
     OR NEW.escalated_by IS DISTINCT FROM OLD.escalated_by
     OR NEW.admin_decision IS DISTINCT FROM OLD.admin_decision
     OR NEW.admin_decision_notes IS DISTINCT FROM OLD.admin_decision_notes
     OR NEW.admin_decision_at IS DISTINCT FROM OLD.admin_decision_at
     OR NEW.admin_decision_by IS DISTINCT FROM OLD.admin_decision_by
     OR NEW.admin_amended_amount IS DISTINCT FROM OLD.admin_amended_amount
  THEN
    RAISE EXCEPTION 'invoice talk/admin columns are RPC-only';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_invoice_talk_columns ON maintenance_invoices;
CREATE TRIGGER trg_protect_invoice_talk_columns
  BEFORE UPDATE ON maintenance_invoices
  FOR EACH ROW
  EXECUTE FUNCTION protect_invoice_talk_columns();

CREATE OR REPLACE FUNCTION escalate_maintenance_invoice(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  uid uuid := auth.uid();
  confirm_vendor int;
  confirm_payer int;
  payer_uid uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO inv FROM maintenance_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invoice not found';
  END IF;

  IF inv.status NOT IN ('submitted', 'rejected') THEN
    RAISE EXCEPTION 'invoice cannot be escalated from status %', inv.status;
  END IF;

  IF inv.vendor_id IS DISTINCT FROM uid
     AND inv.owner_id IS DISTINCT FROM uid
     AND NOT (
       inv.payer_role = 'tenant'
       AND EXISTS (
         SELECT 1 FROM leases l
         WHERE l.property_id = inv.property_id
           AND l.tenant_id = uid
           AND l.status IN ('active', 'pending', 'month_to_month')
       )
     )
  THEN
    RAISE EXCEPTION 'not a party to this invoice';
  END IF;

  payer_uid := CASE
    WHEN inv.payer_role = 'owner' THEN inv.owner_id
    ELSE (
      SELECT l.tenant_id FROM leases l
      WHERE l.property_id = inv.property_id
        AND l.status IN ('active', 'pending', 'month_to_month')
      LIMIT 1
    )
  END;

  SELECT count(*) INTO confirm_vendor
  FROM invoice_talk_confirmations
  WHERE invoice_id = p_invoice_id AND user_id = inv.vendor_id;

  SELECT count(*) INTO confirm_payer
  FROM invoice_talk_confirmations
  WHERE invoice_id = p_invoice_id AND user_id = payer_uid;

  IF confirm_vendor < 1 OR confirm_payer < 1 THEN
    RAISE EXCEPTION 'both vendor and payer must confirm they talked first';
  END IF;

  PERFORM set_config('app.invoice_talk_rpc', '1', true);

  UPDATE maintenance_invoices
  SET
    status = 'disputed',
    escalated_at = now(),
    escalated_by = uid,
    updated_at = now()
  WHERE id = p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_maintenance_invoice_dispute(
  p_invoice_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL,
  p_amended_amount numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  uid uuid := auth.uid();
  new_status text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = uid AND role = 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF p_decision NOT IN ('uphold_vendor', 'amend_amount', 'reject') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  IF p_decision = 'amend_amount' AND (p_amended_amount IS NULL OR p_amended_amount <= 0) THEN
    RAISE EXCEPTION 'amended amount required';
  END IF;

  SELECT * INTO inv FROM maintenance_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invoice not found';
  END IF;

  IF inv.status IS DISTINCT FROM 'disputed' THEN
    RAISE EXCEPTION 'invoice is not disputed';
  END IF;

  IF p_decision = 'reject' THEN
    new_status := 'rejected';
  ELSE
    new_status := 'approved';
  END IF;

  PERFORM set_config('app.invoice_talk_rpc', '1', true);

  UPDATE maintenance_invoices
  SET
    status = new_status,
    admin_decision = p_decision,
    admin_decision_notes = p_notes,
    admin_decision_at = now(),
    admin_decision_by = uid,
    admin_amended_amount = CASE WHEN p_decision = 'amend_amount' THEN p_amended_amount ELSE NULL END,
    total_amount = CASE WHEN p_decision = 'amend_amount' THEN p_amended_amount ELSE total_amount END,
    subtotal = CASE WHEN p_decision = 'amend_amount' THEN p_amended_amount ELSE subtotal END,
    vat_amount = CASE WHEN p_decision = 'amend_amount' THEN 0 ELSE vat_amount END,
    approved_at = CASE WHEN new_status = 'approved' THEN now() ELSE approved_at END,
    approved_by = CASE WHEN new_status = 'approved' THEN uid ELSE approved_by END,
    rejected_at = CASE WHEN new_status = 'rejected' THEN now() ELSE rejected_at END,
    rejection_reason = CASE WHEN new_status = 'rejected' THEN coalesce(p_notes, rejection_reason) ELSE rejection_reason END,
    updated_at = now()
  WHERE id = p_invoice_id
    AND status = 'disputed';
END;
$$;

REVOKE ALL ON FUNCTION escalate_maintenance_invoice(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION resolve_maintenance_invoice_dispute(uuid, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION escalate_maintenance_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_maintenance_invoice_dispute(uuid, text, text, numeric) TO authenticated;

DROP POLICY IF EXISTS party_invoice_audit_insert ON maintenance_invoice_audit_logs;
CREATE POLICY party_invoice_audit_insert ON maintenance_invoice_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM maintenance_invoices mi
      WHERE mi.id = invoice_id
        AND mi.owner_id = owner_id
        AND mi.vendor_id = vendor_id
        AND (
          mi.vendor_id = auth.uid()
          OR mi.owner_id = auth.uid()
          OR (
            mi.payer_role = 'tenant'
            AND EXISTS (
              SELECT 1 FROM leases l
              WHERE l.property_id = mi.property_id
                AND l.tenant_id = auth.uid()
                AND l.status IN ('active', 'pending', 'month_to_month')
            )
          )
        )
    )
  );
