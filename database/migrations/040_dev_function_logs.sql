-- Dev function execution log — tracks Supabase edge function invocations
-- and admin RPC calls so the dev panel can surface execution history.
-- (Created separately here; triggers in each edge function write to this table.)

CREATE TABLE IF NOT EXISTS dev_function_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text NOT NULL,                 -- e.g. 'accrue-deposit-interest', 'lala-ai-chat', 'admin_get_dashboard_stats'
  level         text NOT NULL DEFAULT 'info',  -- 'info', 'warn', 'error'
  message       text NOT NULL,
  metadata      jsonb DEFAULT '{}'::jsonb,     -- function args, duration ms, request_id, etc.
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dev_function_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only access: bypass RLS via SECURITY DEFINER functions below,
-- or allow reads by admins directly via RLS policy.
CREATE POLICY "admins can read dev_function_logs"
  ON dev_function_logs FOR SELECT
  USING (public.is_admin());

CREATE INDEX idx_dev_logs_created_at ON dev_function_logs (created_at DESC);
CREATE INDEX idx_dev_logs_source     ON dev_function_logs (source);
CREATE INDEX idx_dev_logs_level      ON dev_function_logs (level);

COMMENT ON TABLE  dev_function_logs IS 'Execution log for edge functions and admin RPCs. Written by the functions themselves or by admin RPC wrappers.';

-- ──────────────────────────────────────────────
-- RPC: log a function execution
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- RPC: query recent function logs (admin only)
-- ──────────────────────────────────────────────
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
