-- Contract templates and compiled fields for contracts

-- 1) Templates table
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  role_scope TEXT NOT NULL CHECK (role_scope IN ('tenancy','service')),
  content_html TEXT NOT NULL,
  variables_json JSONB NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

-- Read for all authenticated
CREATE POLICY "Authenticated can read active templates" ON public.contract_templates
  FOR SELECT TO authenticated USING (is_active = TRUE);

-- Admin full access (assumes 'admin' role in profiles)
CREATE POLICY "Admins can manage templates" ON public.contract_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 2) Add compiled fields to contracts
ALTER TABLE public.tenancy_contracts
  ADD COLUMN IF NOT EXISTS template_id UUID NULL REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compiled_html TEXT NULL,
  ADD COLUMN IF NOT EXISTS compiled_variables JSONB NULL;

ALTER TABLE public.service_contracts
  ADD COLUMN IF NOT EXISTS template_id UUID NULL REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compiled_html TEXT NULL,
  ADD COLUMN IF NOT EXISTS compiled_variables JSONB NULL;

-- 3) Seed example templates
INSERT INTO public.contract_templates (title, role_scope, content_html, variables_json, created_by)
VALUES
  (
    'Standard Residential Tenancy Agreement', 'tenancy',
    '<h1>{{contract.title}}</h1>\n<p>This Tenancy Agreement is made between <strong>{{owner.full_name}}</strong> (Owner) and <strong>{{tenant.full_name}}</strong> (Tenant) for the property at <strong>{{property.address}}, {{property.city}}</strong>.</p>\n<p>Lease Period: {{lease.lease_start}} to {{lease.lease_end}}</p>\n<p>Monthly Rent: R {{property.rent_amount}}</p>\n<p>Date: {{date.today}}</p>',
    '{"required": ["owner.full_name","tenant.full_name","property.address","property.city","property.rent_amount","lease.lease_start","lease.lease_end","contract.title","date.today"]}',
    NULL
  ),
  (
    'Maintenance Service Agreement', 'service',
    '<h1>{{contract.title}}</h1>\n<p>Between <strong>{{owner.full_name}}</strong> (Owner) and <strong>{{vendor.full_name}}</strong> (Vendor) for services at <strong>{{property.address}}, {{property.city}}</strong>.</p>\n<p>Scope: {{service.scope}}</p>\n<p>Rate: R {{service.rate}} {{service.unit}}</p>\n<p>Date: {{date.today}}</p>',
    '{"required": ["owner.full_name","vendor.full_name","property.address","property.city","service.scope","service.rate","service.unit","contract.title","date.today"]}',
    NULL
  )
ON CONFLICT DO NOTHING;





