-- Minimal profile fetch via SECURITY DEFINER to bypass RLS for rendering names/emails
-- Grants only to authenticated users

create or replace function public.get_profile_minimal(uid uuid)
returns table (
    id uuid,
    full_name text,
    email text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.email
  from public.profiles p
  where p.id = uid;
$$;

revoke all on function public.get_profile_minimal(uuid) from public;
grant execute on function public.get_profile_minimal(uuid) to authenticated;




