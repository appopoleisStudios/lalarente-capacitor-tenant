-- Allow tenants to update their own payment rows for the "Record EFT" flow:
-- tenant taps "Confirm Payment" → status: pending → processing + method/txn
-- then owner confirms receipt → status: processing → completed.
--
-- UAT caught: tenant tapped Confirm Payment, got "EFT recorded" alert, but
-- the UPDATE silently affected 0 rows → owner's Rent Roll "Processing" filter
-- stayed empty forever. End result: rent payments can never be recorded.
--
-- Also adds owner UPDATE policy (owner's "Confirm Receipt" button needs it
-- for processing → completed).

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- SELECT: both parties on the payment can read it
DROP POLICY IF EXISTS payments_select_party ON public.payments;
CREATE POLICY payments_select_party ON public.payments
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR tenant_id = auth.uid());

-- INSERT: owner creates payment schedules; tenant doesn't create rows directly
DROP POLICY IF EXISTS payments_insert_owner ON public.payments;
CREATE POLICY payments_insert_owner ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- UPDATE: both parties can update, but neither can reassign owner_id or
-- tenant_id (WITH CHECK ensures the party stays the same).
DROP POLICY IF EXISTS payments_update_party ON public.payments;
CREATE POLICY payments_update_party ON public.payments
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR tenant_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() OR tenant_id = auth.uid());
