-- MIGRATION 065: Tenant invoice approve/reject (Plane #109)
--
-- Problem: Only the owner could approve/reject vendor invoices. When the
-- vendor bills the tenant (payer_role='tenant'), the tenant has no way to
-- approve or reject — they can only pay after owner approval.
--
-- Fix: Add RLS UPDATE policy so tenants can approve/reject invoices they
-- are billed for (payer_role='tenant' + maintenance request belongs to them).
-- The API layer enforces the same guards (status must be 'submitted',
-- tenant must own the lease on the request's property).

-- ─── 1. Tenant UPDATE policy on maintenance_invoices ──────────────────────────
DROP POLICY IF EXISTS tenant_invoice_update ON maintenance_invoices;

CREATE POLICY tenant_invoice_update ON maintenance_invoices
  FOR UPDATE
  TO authenticated
  USING (
    -- The tenant is billed (payer_role = 'tenant')
    payer_role = 'tenant'
    -- The maintenance request belongs to this tenant (via lease → property)
    AND EXISTS (
      SELECT 1
      FROM maintenance_requests mr
      JOIN leases l ON l.property_id = mr.property_id AND l.tenant_id = auth.uid()
      WHERE mr.id = maintenance_request_id
        AND l.status IN ('active', 'month_to_month')
    )
  )
  WITH CHECK (
    -- Same guard on the new row — tenant can only flip status, not change amounts
    payer_role = 'tenant'
    AND EXISTS (
      SELECT 1
      FROM maintenance_requests mr
      JOIN leases l ON l.property_id = mr.property_id AND l.tenant_id = auth.uid()
      WHERE mr.id = maintenance_request_id
        AND l.status IN ('active', 'month_to_month')
    )
  );

COMMENT ON POLICY tenant_invoice_update ON maintenance_invoices IS
  'Tenants can approve/reject invoices billed to them (payer_role=tenant) on their maintenance requests. (Migration 065 — Plane #109)';
