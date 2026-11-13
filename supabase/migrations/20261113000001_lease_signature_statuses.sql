-- F1: the app's two-step signing flow writes pending_tenant_signature and
-- pending_owner_signature, which leases_status_check rejected. Keep every
-- existing value and add the two signing states.
ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_status_check;
ALTER TABLE leases ADD CONSTRAINT leases_status_check CHECK (status IN (
  'draft',
  'pending_signatures',
  'pending_tenant_signature',
  'pending_owner_signature',
  'active',
  'month_to_month',
  'renewal_pending',
  'expired',
  'terminated',
  'early_terminated'
));
