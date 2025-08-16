-- Enforce one signature per role per contract and clean up existing duplicates

-- 1) Tenancy: delete duplicate signatures keeping the latest by signed_at
with ranked as (
  select id,
         row_number() over (partition by contract_id, signer_role order by signed_at desc, id desc) as rn
  from public.tenancy_contract_signatures
)
delete from public.tenancy_contract_signatures t
using ranked r
where t.id = r.id and r.rn > 1;

-- 2) Service: delete duplicate signatures keeping the latest by signed_at
with ranked as (
  select id,
         row_number() over (partition by contract_id, signer_role order by signed_at desc, id desc) as rn
  from public.service_contract_signatures
)
delete from public.service_contract_signatures s
using ranked r
where s.id = r.id and r.rn > 1;

-- 3) Add unique constraints on (contract_id, signer_role)
do $$ begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='uq_tenancy_signature_role'
  ) then
    create unique index uq_tenancy_signature_role
    on public.tenancy_contract_signatures(contract_id, signer_role);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='uq_service_signature_role'
  ) then
    create unique index uq_service_signature_role
    on public.service_contract_signatures(contract_id, signer_role);
  end if;
end $$;




