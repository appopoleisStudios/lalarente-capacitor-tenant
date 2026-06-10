-- Unified audit trail RPC for the dev admin panel.
-- Combines all audit log tables into a single time-ordered feed.

CREATE OR REPLACE FUNCTION public.admin_get_audit_trail(
  p_limit  int DEFAULT 100,
  p_source text DEFAULT NULL  -- filter by table: 'maintenance', 'inspection', 'privacy', 'contract'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN (
    WITH combined AS (
      -- Maintenance request audit logs
      SELECT
        mal.created_at,
        'maintenance' AS source,
        mal.event,
        mal.data::text AS detail,
        (SELECT full_name FROM profiles WHERE id = mal.actor_id) AS actor_name,
        mal.request_id AS resource_id
      FROM maintenance_request_audit_logs mal
      WHERE p_source IS NULL OR p_source = 'maintenance'

      UNION ALL

      -- Inspection audit logs
      SELECT
        ial.created_at,
        'inspection' AS source,
        ial.event,
        ial.data::text AS detail,
        (SELECT full_name FROM profiles WHERE id = ial.actor_id) AS actor_name,
        ial.inspection_id::text AS resource_id
      FROM inspection_audit_logs ial
      WHERE p_source IS NULL OR p_source = 'inspection'

      UNION ALL

      -- Privacy audit log
      SELECT
        pal.created_at,
        'privacy' AS source,
        pal.action AS event,
        COALESCE(pal.details::text, '') AS detail,
        (SELECT full_name FROM profiles WHERE id = pal.actor_id) AS actor_name,
        pal.resource_id::text AS resource_id
      FROM privacy_audit_log pal
      WHERE p_source IS NULL OR p_source = 'privacy'

      UNION ALL

      -- Contract management audit logs
      SELECT
        cal.created_at,
        'contract' AS source,
        cal.event,
        jsonb_build_object('old', cal.old_values, 'new', cal.new_values)::text AS detail,
        (SELECT full_name FROM profiles WHERE id = cal.actor_id) AS actor_name,
        cal.contract_id::text AS resource_id
      FROM contract_management_audit_logs cal
      WHERE p_source IS NULL OR p_source = 'contract'
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        'created_at',   c.created_at,
        'source',       c.source,
        'event',        c.event,
        'detail',       c.detail,
        'actor_name',   c.actor_name,
        'resource_id',  c.resource_id
      )
      ORDER BY c.created_at DESC
      LIMIT p_limit
    )
    FROM combined c
  );
END;
$$;

-- ──────────────────────────────────────────────
-- RPC: get available audit sources (for filter dropdown)
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_audit_sources()
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT ARRAY['maintenance', 'inspection', 'privacy', 'contract']::text[];
$$;
