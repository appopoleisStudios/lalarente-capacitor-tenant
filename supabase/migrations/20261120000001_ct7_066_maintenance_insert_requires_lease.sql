-- CT7-066: a tenant may report a maintenance issue only when they have a
-- lease signed by both and in effect for that property; an owner only on a
-- property they own. The app already enforces this; the database did not:
-- the permissive INSERT policies `maintenance_requests_tenant_insert`
-- (tenant_id = auth.uid()), `maintenance_requests_tenant_access` (ALL),
-- `maintenance_requests_owner_insert` and `maintenance_requests_owner_access`
-- (owner_id = auth.uid()) let any tenant or owner create a request on ANY
-- property, and permissive policies are OR'd, so the stricter `mr_insert`
-- never mattered.
--
-- A RESTRICTIVE policy is AND'ed with all permissive ones. It applies to
-- INSERT only, so reading, updating and deleting existing requests are
-- unchanged. Service-role writes (edge functions, fixture scripts) bypass RLS.
--
-- Keep LEASE_IN_EFFECT_STATUSES in sync with
-- src/features/leases/utils/leaseInEffect.ts (guarded by
-- src/features/leases/__tests__/maintenanceInsertPolicy.test.ts).
--
-- Rollback:
--   drop policy if exists mr_insert_reporter_must_have_standing on public.maintenance_requests;
--   drop function if exists public.may_report_maintenance(uuid, uuid, uuid);

create or replace function public.may_report_maintenance(
  p_property_id uuid,
  p_owner_id uuid,
  p_tenant_id uuid
) returns boolean
language sql
stable
security definer
-- empty search_path + schema-qualified names: a caller's temporary tables
-- can't shadow properties/leases inside this definer function (SA)
set search_path = ''
as $$
  select
    -- owner reporting on a property they own
    (
      p_owner_id = auth.uid()
      and exists (
        select 1 from public.properties p
        where p.id = p_property_id and p.owner_id = auth.uid()
      )
    )
    or
    -- tenant reporting on the property of their lease in effect, to its owner
    (
      p_tenant_id = auth.uid()
      and exists (
        select 1
        from public.leases l
        join public.properties p on p.id = l.property_id
        where l.tenant_id = auth.uid()
          and l.property_id = p_property_id
          and p.owner_id = p_owner_id
          and l.status in ('active', 'month_to_month', 'renewal_pending') -- LEASE_IN_EFFECT_STATUSES
      )
    );
$$;

revoke all on function public.may_report_maintenance(uuid, uuid, uuid) from public, anon;
grant execute on function public.may_report_maintenance(uuid, uuid, uuid) to authenticated;

drop policy if exists mr_insert_reporter_must_have_standing on public.maintenance_requests;
create policy mr_insert_reporter_must_have_standing
  on public.maintenance_requests
  as restrictive
  for insert
  to authenticated
  with check (public.may_report_maintenance(property_id, owner_id, tenant_id));
