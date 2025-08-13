-- Phase 1.3: Vendor Profile Schema (service categories, services, service areas, availability, documents)
-- Safe to run multiple times: uses IF NOT EXISTS and idempotent constructs

-- 1) Service Categories
CREATE TABLE IF NOT EXISTS public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_categories_active ON public.service_categories(is_active);

-- 2) Vendor Services (what a vendor offers)
CREATE TABLE IF NOT EXISTS public.vendor_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.service_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  base_price numeric(12,2) NOT NULL DEFAULT 0,
  pricing_unit text, -- e.g., per hour, per visit
  min_callout_fee numeric(12,2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_services_vendor ON public.vendor_services(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_services_category ON public.vendor_services(category_id);

-- 3) Vendor Service Areas (where vendor serves)
CREATE TABLE IF NOT EXISTS public.vendor_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  city text,
  province text,
  postal_codes text[],
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_service_areas_vendor ON public.vendor_service_areas(vendor_id);

-- 4) Vendor Availability Slots (recurring or date-bounded)
CREATE TABLE IF NOT EXISTS public.vendor_availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weekday smallint CHECK (weekday BETWEEN 0 AND 6), -- 0=Sun ... 6=Sat
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_recurring boolean DEFAULT true,
  effective_from date DEFAULT CURRENT_DATE,
  effective_to date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_availability_vendor ON public.vendor_availability_slots(vendor_id);

-- 5) Vendor Documents (KYC/verification)
CREATE TABLE IF NOT EXISTS public.vendor_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doc_type text NOT NULL,          -- e.g., 'ID', 'PoliceClearance', 'Certificate'
  file_url text NOT NULL,          -- storage path
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  notes text,
  uploaded_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_vendor_documents_vendor ON public.vendor_documents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_documents_status ON public.vendor_documents(status);

-- RLS enablement
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;

-- Policies
-- service_categories: readable by all authenticated users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'service_categories' AND policyname = 'service_categories_read'
  ) THEN
    CREATE POLICY "service_categories_read" ON public.service_categories
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- vendor_* tables: vendor can CRUD own rows; admins can read all
-- Helper predicate for vendor ownership: profile id equals auth.uid()
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vendor_services' AND policyname = 'vendor_services_owner_crud'
  ) THEN
    CREATE POLICY "vendor_services_owner_crud" ON public.vendor_services
      FOR ALL TO authenticated
      USING ((vendor_id = (select auth.uid())))
      WITH CHECK ((vendor_id = (select auth.uid())));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vendor_service_areas' AND policyname = 'vendor_service_areas_owner_crud'
  ) THEN
    CREATE POLICY "vendor_service_areas_owner_crud" ON public.vendor_service_areas
      FOR ALL TO authenticated
      USING ((vendor_id = (select auth.uid())))
      WITH CHECK ((vendor_id = (select auth.uid())));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vendor_availability_slots' AND policyname = 'vendor_availability_slots_owner_crud'
  ) THEN
    CREATE POLICY "vendor_availability_slots_owner_crud" ON public.vendor_availability_slots
      FOR ALL TO authenticated
      USING ((vendor_id = (select auth.uid())))
      WITH CHECK ((vendor_id = (select auth.uid())));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vendor_documents' AND policyname = 'vendor_documents_owner_crud'
  ) THEN
    CREATE POLICY "vendor_documents_owner_crud" ON public.vendor_documents
      FOR ALL TO authenticated
      USING ((vendor_id = (select auth.uid())))
      WITH CHECK ((vendor_id = (select auth.uid())));
  END IF;
END $$;

-- Optional admin read-all policies can be added later once admin role is defined in RLS roleset

-- Updated timestamps triggers (optional; if extension available). Defer to application layer for now.


