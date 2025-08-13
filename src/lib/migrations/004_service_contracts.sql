-- Service Contracts for Vendor Work (e-sign ready)
-- Associates a vendor with a property manager (owner) and optionally a tenant for specific service work
-- Links to maintenance_requests for v1; can later link to jobs when marketplace is ready

-- 1) Contracts table
CREATE TABLE IF NOT EXISTS public.service_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  maintenance_request_id uuid REFERENCES public.maintenance_requests(id) ON DELETE SET NULL,
  vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  terms jsonb,                      -- structured terms for dynamic templating
  requires_tenant_signature boolean DEFAULT false,
  status text NOT NULL DEFAULT 'draft', -- 'draft'|'pending_signatures'|'partially_signed'|'signed'|'void'
  pdf_url text,
  pdf_sha256 text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_contracts_vendor ON public.service_contracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_service_contracts_owner ON public.service_contracts(owner_id);
CREATE INDEX IF NOT EXISTS idx_service_contracts_tenant ON public.service_contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_contracts_property ON public.service_contracts(property_id);

-- 2) Signatures table
CREATE TABLE IF NOT EXISTS public.service_contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  signer_role text NOT NULL CHECK (signer_role IN ('vendor','owner','tenant')),
  signer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signature_image_url text NOT NULL,
  signed_at timestamptz NOT NULL,
  ip_address inet,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_service_contract_signatures_contract ON public.service_contract_signatures(contract_id);

-- 3) Audit logs
CREATE TABLE IF NOT EXISTS public.service_contract_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  event text NOT NULL, -- created|viewed|sent|signed_by_vendor|signed_by_owner|signed_by_tenant|finalized|voided
  actor_id uuid REFERENCES public.profiles(id),
  data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_contract_audit_contract ON public.service_contract_audit_logs(contract_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contract_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- service_contracts: visible to involved parties (vendor, owner, tenant if present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'service_contracts' AND policyname = 'service_contracts_party_read'
  ) THEN
    CREATE POLICY "service_contracts_party_read" ON public.service_contracts
      FOR SELECT TO authenticated
      USING (
        vendor_id = (select auth.uid())
        OR owner_id = (select auth.uid())
        OR (tenant_id IS NOT NULL AND tenant_id = (select auth.uid()))
      );
  END IF;
END $$;

-- Vendors can insert their draft contracts only if they are the vendor and property owner matches owner_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'service_contracts' AND policyname = 'service_contracts_vendor_insert'
  ) THEN
    CREATE POLICY "service_contracts_vendor_insert" ON public.service_contracts
      FOR INSERT TO authenticated
      WITH CHECK (vendor_id = (select auth.uid()));
  END IF;
END $$;

-- Owners can insert contracts as well
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'service_contracts' AND policyname = 'service_contracts_owner_insert'
  ) THEN
    CREATE POLICY "service_contracts_owner_insert" ON public.service_contracts
      FOR INSERT TO authenticated
      WITH CHECK (owner_id = (select auth.uid()));
  END IF;
END $$;

-- Updates restricted to involved parties
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'service_contracts' AND policyname = 'service_contracts_party_update'
  ) THEN
    CREATE POLICY "service_contracts_party_update" ON public.service_contracts
      FOR UPDATE TO authenticated
      USING (
        vendor_id = (select auth.uid())
        OR owner_id = (select auth.uid())
        OR (tenant_id IS NOT NULL AND tenant_id = (select auth.uid()))
      )
      WITH CHECK (
        vendor_id = (select auth.uid())
        OR owner_id = (select auth.uid())
        OR (tenant_id IS NOT NULL AND tenant_id = (select auth.uid()))
      );
  END IF;
END $$;

-- signatures: signer can insert their signature and all parties can read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'service_contract_signatures' AND policyname = 'service_contract_signatures_read'
  ) THEN
    CREATE POLICY "service_contract_signatures_read" ON public.service_contract_signatures
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.service_contracts c
          WHERE c.id = service_contract_signatures.contract_id
            AND (
              c.vendor_id = (select auth.uid()) OR c.owner_id = (select auth.uid()) OR (c.tenant_id IS NOT NULL AND c.tenant_id = (select auth.uid()))
            )
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'service_contract_signatures' AND policyname = 'service_contract_signatures_insert'
  ) THEN
    CREATE POLICY "service_contract_signatures_insert" ON public.service_contract_signatures
      FOR INSERT TO authenticated
      WITH CHECK (
        signer_id = (select auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.service_contracts c
          WHERE c.id = service_contract_signatures.contract_id
            AND (
              (service_contract_signatures.signer_role = 'vendor' AND c.vendor_id = (select auth.uid()))
              OR (service_contract_signatures.signer_role = 'owner' AND c.owner_id = (select auth.uid()))
              OR (service_contract_signatures.signer_role = 'tenant' AND c.tenant_id = (select auth.uid()))
            )
        )
      );
  END IF;
END $$;

-- audit logs: read only by parties; insert via server function if needed
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'service_contract_audit_logs' AND policyname = 'service_contract_audit_logs_read'
  ) THEN
    CREATE POLICY "service_contract_audit_logs_read" ON public.service_contract_audit_logs
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.service_contracts c
          WHERE c.id = service_contract_audit_logs.contract_id
            AND (
              c.vendor_id = (select auth.uid()) OR c.owner_id = (select auth.uid()) OR (c.tenant_id IS NOT NULL AND c.tenant_id = (select auth.uid()))
            )
        )
      );
  END IF;
END $$;


