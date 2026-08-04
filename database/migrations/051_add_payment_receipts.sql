-- ============================================================
-- MIGRATION 051: Vendor payment receipts (Plane #62 slice 2)
-- ============================================================
-- Receipt PDF on payment completion: the generate-payment-receipt
-- edge function renders the PDF (job details, invoice breakdown,
-- payment confirmation, platform fee breakdown), uploads it to the
-- public `receipts` bucket and persists the public URL here so both
-- the tenant and the vendor can download it (in-app + notifications).
--
-- The bucket is PUBLIC (like inspection-photos / message-attachments)
-- so the download link works for both parties without auth. Paths use
-- the vendor_payment UUID, so links are unguessable.
-- ============================================================

-- 1. Persist the receipt download URL on the payment.
ALTER TABLE vendor_payments
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- 2. Public receipts bucket (PDF only, 5 MB cap).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', true, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['application/pdf'];

-- 3. Public read so the tenant + vendor download links resolve.
--    Uploads are performed by the edge function with the service-role
--    key (RLS bypass), so no client upload policy is needed.
DROP POLICY IF EXISTS "Public can view receipts" ON storage.objects;
CREATE POLICY "Public can view receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts');
