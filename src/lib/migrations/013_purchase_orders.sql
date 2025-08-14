-- Purchase Orders (header + lines) for MMS-lite

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.service_contracts(id) on delete cascade,
  po_number text not null unique,
  currency text default 'ZAR',
  subtotal numeric,
  vat_amount numeric,
  platform_fee_amount numeric,
  total_amount numeric,
  status text not null default 'po_issued', -- po_issued|in_progress|closed|void
  pdf_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  description text not null,
  qty numeric not null default 1,
  unit_price numeric not null,
  unit text null,
  tax_rate numeric null
);

create index if not exists idx_po_contract on public.purchase_orders(contract_id);

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;

-- Read: parties to the service contract can read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='purchase_orders' AND policyname='po_party_read'
  ) THEN
    CREATE POLICY "po_party_read" ON public.purchase_orders
      FOR SELECT TO authenticated
      USING (
        exists (
          select 1 from public.service_contracts c 
          where c.id = purchase_orders.contract_id 
            and (
              c.owner_id = (select auth.uid()) 
              or c.vendor_id = (select auth.uid()) 
              or (c.tenant_id is not null and c.tenant_id = (select auth.uid()))
            )
        )
      );
  END IF;
END $$;

-- Owner can create/update their POs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='purchase_orders' AND policyname='po_owner_write'
  ) THEN
    CREATE POLICY "po_owner_write" ON public.purchase_orders
      FOR INSERT TO authenticated
      WITH CHECK (exists (select 1 from public.service_contracts c where c.id = contract_id and c.owner_id = (select auth.uid())));

    CREATE POLICY "po_owner_update" ON public.purchase_orders
      FOR UPDATE TO authenticated
      USING (exists (select 1 from public.service_contracts c where c.id = contract_id and c.owner_id = (select auth.uid())))
      WITH CHECK (exists (select 1 from public.service_contracts c where c.id = contract_id and c.owner_id = (select auth.uid())));
  END IF;
END $$;

-- Lines follow parent PO permissions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='purchase_order_lines' AND policyname='po_lines_read'
  ) THEN
    CREATE POLICY "po_lines_read" ON public.purchase_order_lines
      FOR SELECT TO authenticated
      USING (exists (select 1 from public.purchase_orders p where p.id = purchase_order_lines.po_id));

    CREATE POLICY "po_lines_write" ON public.purchase_order_lines
      FOR INSERT TO authenticated
      WITH CHECK (exists (
        select 1 from public.purchase_orders p 
        join public.service_contracts c on c.id = p.contract_id
        where p.id = purchase_order_lines.po_id and c.owner_id = (select auth.uid())
      ));

    CREATE POLICY "po_lines_update" ON public.purchase_order_lines
      FOR UPDATE TO authenticated
      USING (exists (
        select 1 from public.purchase_orders p 
        join public.service_contracts c on c.id = p.contract_id
        where p.id = purchase_order_lines.po_id and c.owner_id = (select auth.uid())
      ))
      WITH CHECK (exists (
        select 1 from public.purchase_orders p 
        join public.service_contracts c on c.id = p.contract_id
        where p.id = purchase_order_lines.po_id and c.owner_id = (select auth.uid())
      ));
  END IF;
END $$;
