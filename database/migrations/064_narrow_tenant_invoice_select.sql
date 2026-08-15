-- ============================================================
-- MIGRATION 064: Narrow tenant_invoice_select to tenant-payable only
-- ============================================================
-- LIVE LEAK (found by scripts/verify-vendor-payment-scenarios.mjs S6):
-- migration 047's tenant_invoice_select policy exposes EVERY invoice on the
-- tenant's maintenance requests to the tenant role — including invoices with
-- payer_role='owner' (owner-payable). The app's vendor-payments list filters
-- payer_role='tenant' in SQL, so the UI never shows them, but raw REST
-- (PostgREST) returns them: a tenant could read the owner's payable amounts
-- and invoice details for the same request.
--
-- Fix: the tenant policy must only grant SELECT on invoices the tenant
-- actually owes (payer_role='tenant'). Owner-payable invoices stay visible
-- to owners and vendors only (their own policies in 044/047 are unchanged).
--
-- Idempotent: drop + recreate the policy.
-- ============================================================

DROP POLICY IF EXISTS tenant_invoice_select ON maintenance_invoices;

CREATE POLICY tenant_invoice_select ON maintenance_invoices
  FOR SELECT
  USING (
    payer_role = 'tenant'
    AND maintenance_request_id IN (
      SELECT id FROM maintenance_requests WHERE tenant_id = auth.uid()
    )
  );

COMMENT ON POLICY tenant_invoice_select ON maintenance_invoices IS
  'Tenants can view invoices THEY owe (payer_role=tenant) on their maintenance requests — owner-payable invoices are NOT exposed to tenants. (Migration 064 — closes the payer-exclusivity leak found by the vendor-payment full-suite S6.)';
