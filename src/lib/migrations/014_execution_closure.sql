-- Job execution & closure for MMS-lite

create table if not exists public.job_executions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.service_contracts(id) on delete cascade,
  status text not null default 'not_started', -- not_started|in_progress|paused|completed
  start_at timestamptz null,
  end_at timestamptz null,
  sla_window_start timestamptz null,
  sla_window_end timestamptz null,
  notes text null,
  created_at timestamptz default now()
);

create table if not exists public.job_attachments (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.job_executions(id) on delete cascade,
  url text not null,
  kind text not null -- photo|pdf|other
);

create table if not exists public.closure_reports (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.service_contracts(id) on delete cascade,
  vendor_notes text null,
  owner_accept_at timestamptz null,
  tenant_ack_at timestamptz null,
  closed_at timestamptz null
);

create index if not exists idx_exec_contract on public.job_executions(contract_id);

alter table public.job_executions enable row level security;
alter table public.job_attachments enable row level security;
alter table public.closure_reports enable row level security;

-- Read for parties
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_executions' AND policyname='exec_party_read'
  ) THEN
    CREATE POLICY "exec_party_read" ON public.job_executions
      FOR SELECT TO authenticated
      USING (
        exists (
          select 1 from public.service_contracts c 
          where c.id = job_executions.contract_id 
            and (
              c.owner_id = (select auth.uid()) 
              or c.vendor_id = (select auth.uid()) 
              or (c.tenant_id is not null and c.tenant_id = (select auth.uid()))
            )
        )
      );
  END IF;
END $$;

-- Vendor can update execution rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_executions' AND policyname='exec_vendor_write'
  ) THEN
    CREATE POLICY "exec_vendor_write" ON public.job_executions
      FOR INSERT TO authenticated
      WITH CHECK (exists (select 1 from public.service_contracts c where c.id = contract_id and c.vendor_id = (select auth.uid())));

    CREATE POLICY "exec_vendor_update" ON public.job_executions
      FOR UPDATE TO authenticated
      USING (exists (select 1 from public.service_contracts c where c.id = contract_id and c.vendor_id = (select auth.uid())))
      WITH CHECK (exists (select 1 from public.service_contracts c where c.id = contract_id and c.vendor_id = (select auth.uid())));
  END IF;
END $$;

-- Attachments: vendor writes, parties read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_attachments' AND policyname='attach_party_read'
  ) THEN
    CREATE POLICY "attach_party_read" ON public.job_attachments
      FOR SELECT TO authenticated
      USING (exists (select 1 from public.job_executions e join public.service_contracts c on c.id = e.contract_id where e.id = job_attachments.execution_id and (
        c.owner_id = (select auth.uid()) or c.vendor_id = (select auth.uid()) or (c.tenant_id is not null and c.tenant_id = (select auth.uid()))
      )));

    CREATE POLICY "attach_vendor_write" ON public.job_attachments
      FOR INSERT TO authenticated
      WITH CHECK (exists (select 1 from public.job_executions e join public.service_contracts c on c.id = e.contract_id where e.id = job_attachments.execution_id and c.vendor_id = (select auth.uid())));
  END IF;
END $$;

-- Closure reports: vendor inserts, owner/tenant ack
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='closure_reports' AND policyname='closure_party_read'
  ) THEN
    CREATE POLICY "closure_party_read" ON public.closure_reports
      FOR SELECT TO authenticated
      USING (exists (select 1 from public.service_contracts c where c.id = closure_reports.contract_id and (
        c.owner_id = (select auth.uid()) or c.vendor_id = (select auth.uid()) or (c.tenant_id is not null and c.tenant_id = (select auth.uid()))
      )));

    CREATE POLICY "closure_vendor_insert" ON public.closure_reports
      FOR INSERT TO authenticated
      WITH CHECK (exists (select 1 from public.service_contracts c where c.id = contract_id and c.vendor_id = (select auth.uid())));

    CREATE POLICY "closure_owner_update" ON public.closure_reports
      FOR UPDATE TO authenticated
      USING (exists (select 1 from public.service_contracts c where c.id = contract_id and c.owner_id = (select auth.uid())))
      WITH CHECK (exists (select 1 from public.service_contracts c where c.id = contract_id and c.owner_id = (select auth.uid())));
  END IF;
END $$;
