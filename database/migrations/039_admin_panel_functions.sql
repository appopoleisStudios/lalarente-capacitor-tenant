-- Admin panel RPC functions
-- These use SECURITY DEFINER to bypass RLS for authenticated admin users.
-- Each function checks the caller's role before returning data.

-- ──────────────────────────────────────────────
-- Helper: check if current user is an admin
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- Dashboard: platform stats
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- List all users (admin view)
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- Toggle dev_admin flag
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- List all properties (admin view)
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- List all leases (admin view)
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- List all maintenance requests (admin view)
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
Get payment stats (admin view)
-- ──────────────────────────────────────────────
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
