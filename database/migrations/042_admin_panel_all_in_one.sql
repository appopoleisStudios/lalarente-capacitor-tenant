-- ═══════════════════════════════════════════════════════════════
-- ADMIN PANEL — Full Migration (Migrations 038 → 041)
-- ═══════════════════════════════════════════════════════════════
-- Run this entire file in Supabase SQL Editor.
-- After running, set at least one user as admin:
--   UPDATE profiles SET role = 'admin', dev_admin = true
--   WHERE email = 'your-email@example.com';
-- ═══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- 038: Add dev_admin flag to profiles
-- ──────────────────────────────────────────────
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS dev_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.dev_admin IS 'If true, user has developer-level access to dev tools (Plane issues, env viewer, Sentry toggle). Only meaningful when role = ''admin''.';

-- ──────────────────────────────────────────────
-- 039: Admin panel RPC functions
-- ──────────────────────────────────────────────

-- Helper: check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Dashboard: platform stats
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT jsonb_build_object(
    'total_users',        (SELECT count(*) FROM profiles),
    'total_properties',   (SELECT count(*) FROM properties),
    'total_leases',       (SELECT count(*) FROM leases),
    'active_leases',      (SELECT count(*) FROM leases WHERE status = 'active'),
    'maintenance_open',   (SELECT count(*) FROM maintenance_requests WHERE status NOT IN ('completed', 'cancelled')),
    'monthly_revenue',    (SELECT COALESCE(sum(amount), 0) FROM payments WHERE status = 'paid' AND created_at >= now() - interval '30 days'),
    'total_disputes',     (SELECT count(*) FROM payment_disputes),
    'total_arrears',      (SELECT COALESCE(sum(total_owed), 0) FROM arrears_escalations WHERE resolved_at IS NULL)
  ) INTO result;

  RETURN result;
END;
$$;

-- List all users (admin view)
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN (SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'email', p.email,
      'role', p.role,
      'dev_admin', p.dev_admin,
      'verification_status', p.verification_status,
      'created_at', p.created_at
    )
    FROM profiles p
    ORDER BY p.created_at DESC
  ));
END;
$$;

-- Toggle dev_admin flag
CREATE OR REPLACE FUNCTION public.admin_toggle_dev_admin(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
AS $$
DECLARE
  new_value boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  UPDATE profiles
  SET dev_admin = NOT dev_admin
  WHERE id = target_user_id
  RETURNING dev_admin INTO new_value;

  RETURN new_value;
END;
$$;

-- List all properties (admin view)
CREATE OR REPLACE FUNCTION public.admin_get_properties()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN (SELECT jsonb_agg(
    jsonb_build_object(
      'id', prop.id,
      'title', prop.title,
      'city', prop.city,
      'rent_amount', prop.rent_amount,
      'status', prop.status,
      'created_at', prop.created_at,
      'owner_name', (SELECT full_name FROM profiles WHERE id = prop.owner_id)
    )
    FROM properties prop
    ORDER BY prop.created_at DESC
  ));
END;
$$;

-- List all leases (admin view)
CREATE OR REPLACE FUNCTION public.admin_get_leases()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN (SELECT jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'start_date', l.start_date,
      'end_date', l.end_date,
      'monthly_rent', l.monthly_rent,
      'status', l.status,
      'deposit_amount', l.deposit_amount,
      'owner_name', (SELECT full_name FROM profiles WHERE id = l.owner_id),
      'tenant_name', (SELECT full_name FROM profiles WHERE id = l.tenant_id)
    )
    FROM leases l
    ORDER BY l.created_at DESC
  ));
END;
$$;

-- List all maintenance requests (admin view)
CREATE OR REPLACE FUNCTION public.admin_get_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN (SELECT jsonb_agg(
    jsonb_build_object(
      'id', mr.id,
      'title', mr.title,
      'status', mr.status,
      'priority', mr.priority,
      'estimated_cost', mr.estimated_cost,
      'created_at', mr.created_at,
      'owner_name', (SELECT full_name FROM profiles WHERE id = mr.owner_id),
      'tenant_name', (SELECT full_name FROM profiles WHERE id = mr.tenant_id)
    )
    FROM maintenance_requests mr
    ORDER BY mr.created_at DESC
  ));
END;
$$;

-- Payment stats (admin view)
CREATE OR REPLACE FUNCTION public.admin_get_payment_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT jsonb_build_object(
    'total_payments',     (SELECT count(*) FROM payments),
    'paid_payments',      (SELECT count(*) FROM payments WHERE status = 'paid'),
    'overdue_payments',   (SELECT count(*) FROM payments WHERE status = 'overdue'),
    'active_disputes',    (SELECT count(*) FROM payment_disputes),
    'total_arrears',      (SELECT COALESCE(sum(total_owed), 0) FROM arrears_escalations WHERE resolved_at IS NULL)
  ) INTO result;

  RETURN result;
END;
$$;

-- ──────────────────────────────────────────────
-- 040: Dev function execution log
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dev_function_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text NOT NULL,
  level         text NOT NULL DEFAULT 'info',
  message       text NOT NULL,
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dev_function_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can read dev_function_logs"
  ON dev_function_logs FOR SELECT
  USING (public.is_admin());

CREATE INDEX idx_dev_logs_created_at ON dev_function_logs (created_at DESC);
CREATE INDEX idx_dev_logs_source     ON dev_function_logs (source);
CREATE INDEX idx_dev_logs_level      ON dev_function_logs (level);

-- RPC: log a function execution
CREATE OR REPLACE FUNCTION public.dev_log(
  p_source   text,
  p_level    text DEFAULT 'info',
  p_message  text DEFAULT '',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO dev_function_logs (source, level, message, metadata)
  VALUES (p_source, p_level, p_message, p_metadata)
  RETURNING id INTO log_id;
  RETURN log_id;
END;
$$;

-- RPC: query recent function logs (admin only)
CREATE OR REPLACE FUNCTION public.dev_get_logs(
  p_limit  int DEFAULT 100,
  p_source text DEFAULT NULL,
  p_level  text DEFAULT NULL
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

  RETURN (SELECT jsonb_agg(
    jsonb_build_object(
      'id',         l.id,
      'source',     l.source,
      'level',      l.level,
      'message',    l.message,
      'metadata',   l.metadata,
      'created_at', l.created_at
    )
    FROM dev_function_logs l
    WHERE (p_source IS NULL OR l.source = p_source)
      AND (p_level  IS NULL OR l.level = p_level)
    ORDER BY l.created_at DESC
    LIMIT p_limit
  ));
END;
$$;

-- ──────────────────────────────────────────────
-- 041: Unified audit trail
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_audit_trail(
  p_limit  int DEFAULT 100,
  p_source text DEFAULT NULL
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

CREATE OR REPLACE FUNCTION public.admin_get_audit_sources()
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT ARRAY['maintenance', 'inspection', 'privacy', 'contract']::text[];
$$;
