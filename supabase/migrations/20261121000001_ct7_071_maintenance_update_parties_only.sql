-- CT7-071: "Request parties can update maintenance requests" also allowed
-- (visibility = 'public'), so ANY signed-in user could edit a public request
-- (status, description, selected vendor, ...). Only the guard trigger stopped
-- them changing tenant/owner/property.
--
-- Viewing a public job stays allowed (maintenance_requests_vendor_select).
-- Editing is limited to the request's parties: owner, tenant, the assigned or
-- selected vendor, and invited vendors. Nothing in the app needs the public
-- clause: the only non-party write (a vendor's quote bumping mms_status) is
-- filtered on mms_status = 'vendor_routing', which nothing ever sets.
--
-- Rollback: recreate the policy with "OR visibility = 'public'" added to both
-- USING and WITH CHECK (see 20261113000008).

drop policy if exists "Request parties can update maintenance requests" on public.maintenance_requests;
create policy "Request parties can update maintenance requests"
  on public.maintenance_requests
  for update to authenticated
  using (
    owner_id = auth.uid()
    or tenant_id = auth.uid()
    or vendor_id = auth.uid()
    or selected_vendor_id = auth.uid()
    or public.vendor_invited_to_request(id)
  )
  with check (
    owner_id = auth.uid()
    or tenant_id = auth.uid()
    or vendor_id = auth.uid()
    or selected_vendor_id = auth.uid()
    or public.vendor_invited_to_request(id)
  );
