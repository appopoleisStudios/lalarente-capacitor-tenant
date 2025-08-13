-- Audit log writer RPCs with SECURITY DEFINER so clients can record events safely

create or replace function public.log_tenancy_contract_event(p_contract_id uuid, p_event text, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ok boolean := false;
begin
  if uid is null then
    return;
  end if;
  select true into ok from public.tenancy_contracts c
  where c.id = p_contract_id and (c.owner_id = uid or c.tenant_id = uid);
  if not ok then
    return;
  end if;
  insert into public.tenancy_contract_audit_logs(contract_id, event, actor_id, data)
  values (p_contract_id, p_event, uid, coalesce(p_data, '{}'::jsonb));
end;
$$;

revoke all on function public.log_tenancy_contract_event(uuid, text, jsonb) from public;
grant execute on function public.log_tenancy_contract_event(uuid, text, jsonb) to authenticated;


create or replace function public.log_service_contract_event(p_contract_id uuid, p_event text, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ok boolean := false;
begin
  if uid is null then
    return;
  end if;
  select true into ok from public.service_contracts c
  where c.id = p_contract_id and (c.owner_id = uid or c.vendor_id = uid or (c.tenant_id is not null and c.tenant_id = uid));
  if not ok then
    return;
  end if;
  insert into public.service_contract_audit_logs(contract_id, event, actor_id, data)
  values (p_contract_id, p_event, uid, coalesce(p_data, '{}'::jsonb));
end;
$$;

revoke all on function public.log_service_contract_event(uuid, text, jsonb) from public;
grant execute on function public.log_service_contract_event(uuid, text, jsonb) to authenticated;



