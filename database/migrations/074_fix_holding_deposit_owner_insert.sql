-- 074_fix_holding_deposit_owner_insert.sql
--
-- CT7-017 — Owner "Send Request" on Request Holding Deposit threw
-- "failed to create holding deposit" during the 2026-11-07 live
-- client test session. Root cause: migration 028 only granted
-- INSERT to the tenant:
--
--   CREATE POLICY "Tenants can create holding deposits"
--     ON holding_deposits FOR INSERT TO authenticated
--     WITH CHECK (tenant_id = auth.uid());
--
-- But the app's owner-side flow calls holdingDepositApi.createDeposit()
-- from an owner-authenticated session. `auth.uid()` is the OWNER's id,
-- which is not equal to `tenant_id`, so every owner-initiated INSERT
-- is rejected by the WITH CHECK.
--
-- Fix: add a parallel policy that allows the signed-in owner of the
-- property to create a holding_deposit row. Tenant scoping stays
-- correct (tenant_id still identifies the tenant); owner authorization
-- flows through the properties table so an owner can only request
-- deposits on their own properties.
--
-- Tenant-initiated INSERTs are still allowed via the existing policy.
-- Both policies OR together under PostgreSQL RLS semantics, so no
-- existing flow breaks.

CREATE POLICY "Owners can create holding deposits on their properties"
  ON holding_deposits FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM properties
      WHERE properties.id = holding_deposits.property_id
        AND properties.owner_id = auth.uid()
    )
  );
