-- Inspection acknowledgements (Owner ↔ Tenant)
-- Add optional owner signature and an audit log table

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS owner_signature text;

CREATE TABLE IF NOT EXISTS public.inspection_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  event text NOT NULL, -- created|scheduled|completed|signed_by_tenant|signed_by_owner
  actor_id uuid REFERENCES public.profiles(id),
  data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspection_audit_logs_inspection ON public.inspection_audit_logs(inspection_id, created_at DESC);

ALTER TABLE public.inspection_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inspection_audit_logs' AND policyname = 'inspection_audit_logs_read'
  ) THEN
    CREATE POLICY "inspection_audit_logs_read" ON public.inspection_audit_logs
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.inspections i
          WHERE i.id = inspection_audit_logs.inspection_id
            AND (
              i.tenant_id = (select auth.uid())
              OR i.inspector_id = (select auth.uid())
              OR EXISTS (
                SELECT 1 FROM public.properties p WHERE p.id = i.property_id AND p.owner_id = (select auth.uid())
              )
            )
        )
      );
  END IF;
END $$;




