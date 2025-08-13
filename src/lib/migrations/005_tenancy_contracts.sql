-- Tenancy Contracts (Owner ↔ Tenant)
-- Links to properties and leases; supports e-sign and audit trail

CREATE TABLE IF NOT EXISTS public.tenancy_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  lease_id uuid REFERENCES public.leases(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  terms jsonb,
  status text NOT NULL DEFAULT 'draft', -- 'draft'|'pending_signatures'|'partially_signed'|'signed'|'void'
  requires_owner_signature boolean DEFAULT true,
  requires_tenant_signature boolean DEFAULT true,
  pdf_url text,
  pdf_sha256 text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenancy_contracts_property ON public.tenancy_contracts(property_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_contracts_owner ON public.tenancy_contracts(owner_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_contracts_tenant ON public.tenancy_contracts(tenant_id);

CREATE TABLE IF NOT EXISTS public.tenancy_contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.tenancy_contracts(id) ON DELETE CASCADE,
  signer_role text NOT NULL CHECK (signer_role IN ('owner','tenant')),
  signer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signature_image_url text NOT NULL,
  signed_at timestamptz NOT NULL,
  ip_address inet,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_tenancy_contract_signatures_contract ON public.tenancy_contract_signatures(contract_id);

CREATE TABLE IF NOT EXISTS public.tenancy_contract_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.tenancy_contracts(id) ON DELETE CASCADE,
  event text NOT NULL, -- created|viewed|sent|signed_by_owner|signed_by_tenant|finalized|voided
  actor_id uuid REFERENCES public.profiles(id),
  data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenancy_contract_audit_contract ON public.tenancy_contract_audit_logs(contract_id, created_at DESC);

-- RLS
ALTER TABLE public.tenancy_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenancy_contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenancy_contract_audit_logs ENABLE ROW LEVEL SECURITY;

-- Parties can read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenancy_contracts' AND policyname = 'tenancy_contracts_party_read'
  ) THEN
    CREATE POLICY "tenancy_contracts_party_read" ON public.tenancy_contracts
      FOR SELECT TO authenticated
      USING (
        owner_id = (select auth.uid()) OR tenant_id = (select auth.uid())
      );
  END IF;
END $$;

-- Owner or Tenant can insert contracts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenancy_contracts' AND policyname = 'tenancy_contracts_owner_insert'
  ) THEN
    CREATE POLICY "tenancy_contracts_owner_insert" ON public.tenancy_contracts
      FOR INSERT TO authenticated
      WITH CHECK (owner_id = (select auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenancy_contracts' AND policyname = 'tenancy_contracts_tenant_insert'
  ) THEN
    CREATE POLICY "tenancy_contracts_tenant_insert" ON public.tenancy_contracts
      FOR INSERT TO authenticated
      WITH CHECK (tenant_id = (select auth.uid()));
  END IF;
END $$;

-- Parties can update
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenancy_contracts' AND policyname = 'tenancy_contracts_party_update'
  ) THEN
    CREATE POLICY "tenancy_contracts_party_update" ON public.tenancy_contracts
      FOR UPDATE TO authenticated
      USING (owner_id = (select auth.uid()) OR tenant_id = (select auth.uid()))
      WITH CHECK (owner_id = (select auth.uid()) OR tenant_id = (select auth.uid()));
  END IF;
END $$;

-- Signatures: read by parties
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenancy_contract_signatures' AND policyname = 'tenancy_contract_signatures_read'
  ) THEN
    CREATE POLICY "tenancy_contract_signatures_read" ON public.tenancy_contract_signatures
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.tenancy_contracts c
          WHERE c.id = tenancy_contract_signatures.contract_id
            AND (c.owner_id = (select auth.uid()) OR c.tenant_id = (select auth.uid()))
        )
      );
  END IF;
END $$;

-- Signatures: signer inserts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenancy_contract_signatures' AND policyname = 'tenancy_contract_signatures_insert'
  ) THEN
    CREATE POLICY "tenancy_contract_signatures_insert" ON public.tenancy_contract_signatures
      FOR INSERT TO authenticated
      WITH CHECK (
        signer_id = (select auth.uid()) AND EXISTS (
          SELECT 1 FROM public.tenancy_contracts c
          WHERE c.id = tenancy_contract_signatures.contract_id
            AND ((tenancy_contract_signatures.signer_role = 'owner' AND c.owner_id = (select auth.uid()))
                 OR (tenancy_contract_signatures.signer_role = 'tenant' AND c.tenant_id = (select auth.uid())))
        )
      );
  END IF;
END $$;

-- Audit logs: parties can read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenancy_contract_audit_logs' AND policyname = 'tenancy_contract_audit_logs_read'
  ) THEN
    CREATE POLICY "tenancy_contract_audit_logs_read" ON public.tenancy_contract_audit_logs
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.tenancy_contracts c
          WHERE c.id = tenancy_contract_audit_logs.contract_id
            AND (c.owner_id = (select auth.uid()) OR c.tenant_id = (select auth.uid()))
        )
      );
  END IF;
END $$;


