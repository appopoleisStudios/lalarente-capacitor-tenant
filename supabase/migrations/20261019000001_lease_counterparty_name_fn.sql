-- Allow lease counterparties (owner ↔ tenant) to read each other's full_name
-- without exposing the full profile row. Avoids showing "Unknown" in the
-- compose message screen when RLS on profiles blocks cross-party reads.
--
-- Why not relax profiles RLS? Keeps the general policy strict — only this
-- lease-scoped fn exposes the display name, nothing else.

CREATE OR REPLACE FUNCTION public.get_lease_counterparty_name(p_lease_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_owner_id uuid;
  v_tenant_id uuid;
  v_name text;
BEGIN
  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT owner_id, tenant_id INTO v_owner_id, v_tenant_id
  FROM leases
  WHERE id = p_lease_id;

  -- Caller must be party to the lease
  IF v_user = v_owner_id THEN
    SELECT full_name INTO v_name FROM profiles WHERE id = v_tenant_id;
  ELSIF v_user = v_tenant_id THEN
    SELECT full_name INTO v_name FROM profiles WHERE id = v_owner_id;
  ELSE
    RETURN NULL;
  END IF;

  RETURN v_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lease_counterparty_name(uuid) TO authenticated;
