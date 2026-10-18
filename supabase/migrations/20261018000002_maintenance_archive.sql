-- Per-role archiving for maintenance_requests.
-- Each role archives independently — owner archiving doesn't hide from tenant/vendor.
-- NULL = not archived; TRUE = archived by that role.

ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS archived_by_owner  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_by_tenant BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_by_vendor BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS maintenance_requests_archived_owner_idx
  ON maintenance_requests (owner_id, archived_by_owner)
  WHERE archived_by_owner = FALSE;

CREATE INDEX IF NOT EXISTS maintenance_requests_archived_tenant_idx
  ON maintenance_requests (tenant_id, archived_by_tenant)
  WHERE archived_by_tenant = FALSE;

CREATE INDEX IF NOT EXISTS maintenance_requests_archived_vendor_idx
  ON maintenance_requests (selected_vendor_id, archived_by_vendor)
  WHERE archived_by_vendor = FALSE;
