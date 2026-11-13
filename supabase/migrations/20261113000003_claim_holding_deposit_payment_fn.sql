-- F4 follow-up: the tenant can read their holding deposit but RLS gives them
-- no UPDATE, so "I Have Paid" matched zero rows. Rather than opening UPDATE
-- (which would let the tenant set status = 'paid' themselves), this function
-- only records the payment method on the caller's own pending deposit. The
-- owner still confirms receipt.

CREATE OR REPLACE FUNCTION public.claim_holding_deposit_payment(
  p_deposit_id uuid,
  p_payment_method text
)
RETURNS SETOF holding_deposits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  UPDATE holding_deposits
  SET payment_method = p_payment_method,
      updated_at = now()
  WHERE id = p_deposit_id
    AND tenant_id = auth.uid()
    AND status = 'pending'
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_holding_deposit_payment(uuid, text) TO authenticated;
