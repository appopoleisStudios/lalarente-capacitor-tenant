-- Security (POPIA): "contracts_select_auth" let ANY signed-in user read every
-- signed lease in the contracts bucket. Only the lease's owner and tenant may
-- ("Users can view lease contracts" stays). Found via the temporary
-- inspection function from 20261115000002, removed here.
DROP POLICY IF EXISTS "contracts_select_auth" ON storage.objects;
DROP FUNCTION IF EXISTS public.tmp_storage_policies();
