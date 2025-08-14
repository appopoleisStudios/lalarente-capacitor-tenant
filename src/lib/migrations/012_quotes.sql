-- Quotes and Quote Lines for Vendor MMS lifecycle
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  request_id uuid null references public.maintenance_requests(id) on delete set null,
  contract_id uuid null references public.service_contracts(id) on delete set null,
  status text not null default 'requested', -- requested|submitted|approved|change_requested|rejected
  subtotal numeric null,
  vat_amount numeric null,
  discount_amount numeric null,
  total_amount numeric null,
  notes text null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  qty numeric not null default 1,
  unit_price numeric not null,
  unit text null,
  tax_rate numeric null
);

-- Indexes
create index if not exists idx_quotes_vendor on public.quotes(vendor_id, created_at desc);
create index if not exists idx_quotes_contract on public.quotes(contract_id);

-- RLS
alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;

-- Parties can read quotes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotes' AND policyname='quotes_party_read'
  ) THEN
    CREATE POLICY "quotes_party_read" ON public.quotes
      FOR SELECT TO authenticated
      USING (
        vendor_id = (SELECT auth.uid())
        OR owner_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.service_contracts c WHERE c.id = quotes.contract_id AND (
            c.vendor_id = (SELECT auth.uid()) OR c.owner_id = (SELECT auth.uid()) OR (c.tenant_id IS NOT NULL AND c.tenant_id = (SELECT auth.uid()))
          )
        )
      );
  END IF;
END $$;

-- Vendor can insert/update their quotes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotes' AND policyname='quotes_vendor_write'
  ) THEN
    CREATE POLICY "quotes_vendor_write" ON public.quotes
      FOR INSERT TO authenticated
      WITH CHECK (vendor_id = (SELECT auth.uid()));

    CREATE POLICY "quotes_vendor_update" ON public.quotes
      FOR UPDATE TO authenticated
      USING (vendor_id = (SELECT auth.uid()))
      WITH CHECK (vendor_id = (SELECT auth.uid()));
  END IF;
END $$;

-- Lines follow parent quote permissions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quote_lines' AND policyname='quote_lines_read'
  ) THEN
    CREATE POLICY "quote_lines_read" ON public.quote_lines
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_lines.quote_id));

    CREATE POLICY "quote_lines_write" ON public.quote_lines
      FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_lines.quote_id AND q.vendor_id = (SELECT auth.uid())));

    CREATE POLICY "quote_lines_update" ON public.quote_lines
      FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_lines.quote_id AND q.vendor_id = (SELECT auth.uid())))
      WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_lines.quote_id AND q.vendor_id = (SELECT auth.uid())));
  END IF;
END $$;
