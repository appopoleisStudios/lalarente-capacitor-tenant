-- SA review (#237): a phone's push token must belong to whoever is signed in
-- on it. If a session ended without a sign-out (e.g. token refresh failure),
-- the row stayed with the previous user, RLS blocked the next user's upsert,
-- and the previous user's notifications kept arriving on that phone.
-- claim_push_token moves the token to the caller. Tokens aren't readable by
-- other users, so this can't be used to take over someone else's device.
CREATE OR REPLACE FUNCTION public.claim_push_token(p_token text, p_platform text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;
  IF p_token IS NULL OR length(p_token) < 10 OR p_platform NOT IN ('ios', 'android', 'web') THEN
    RAISE EXCEPTION 'invalid push token' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.push_tokens (user_id, token, platform)
  VALUES (v_uid, p_token, p_platform)
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        updated_at = now();
END $$;

REVOKE ALL ON FUNCTION public.claim_push_token(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_push_token(text, text) TO authenticated;
