-- Security (POPIA): the contracts and signatures buckets had SELECT policies
-- "TO public USING (bucket_id = ...)", so anyone holding the app's anon key
-- (shipped in every APK) could list and download every signed lease and every
-- signature, and any signed-in user could open any lease. Both buckets are
-- private; the app reads them through signed URLs. Drop the public policies —
-- "Users can view lease contracts" / the signature party policies remain, so
-- only a lease's owner and tenant (and inspection parties) can read.
DROP POLICY IF EXISTS "Public can view lease contracts" ON storage.objects;
DROP POLICY IF EXISTS "Public can view lease signatures" ON storage.objects;
