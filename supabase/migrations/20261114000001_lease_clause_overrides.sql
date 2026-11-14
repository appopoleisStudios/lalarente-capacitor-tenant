-- CT7-022 v2: owners can edit or remove the editable standard lease clauses
-- before sending the lease. Only the differences from the template are
-- stored: { "<clause id>": { "removed": true } | { "body": "<new text>" } }.
-- Every PDF render (review preview, signing, regeneration) applies them.
ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS lease_clause_overrides jsonb;

COMMENT ON COLUMN public.leases.lease_clause_overrides IS
  'Owner edits/removals of standard lease clauses, keyed by clause id (CT7-022).';
