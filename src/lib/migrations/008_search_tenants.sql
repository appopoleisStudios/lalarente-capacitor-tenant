-- Safe tenant search via RPC returning minimal fields, bypassing RLS via SECURITY DEFINER
-- Returns only id and full_name for tenants whose names match the query

create or replace function public.search_tenants_by_name(q text)
returns table(id uuid, full_name text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.full_name
  from public.profiles p
  where auth.uid() is not null
    and p.role = 'tenant'
    and p.full_name ilike '%' || q || '%'
  order by p.full_name asc
  limit 10;
$$;

revoke all on function public.search_tenants_by_name(text) from public;
grant execute on function public.search_tenants_by_name(text) to authenticated;


