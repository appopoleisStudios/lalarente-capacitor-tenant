-- Allow vendors to insert their own service categories
DROP POLICY IF EXISTS "Vendors can insert own services" ON vendor_services;
CREATE POLICY "Vendors can insert own services"
  ON vendor_services
  FOR INSERT
  WITH CHECK (
    auth.uid() = vendor_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'vendor'
    )
  );

-- Allow vendors to update their own services
DROP POLICY IF EXISTS "Vendors can update own services" ON vendor_services;
CREATE POLICY "Vendors can update own services"
  ON vendor_services
  FOR UPDATE
  USING (auth.uid() = vendor_id)
  WITH CHECK (auth.uid() = vendor_id);

-- Allow vendors to delete their own services
DROP POLICY IF EXISTS "Vendors can delete own services" ON vendor_services;
CREATE POLICY "Vendors can delete own services"
  ON vendor_services
  FOR DELETE
  USING (auth.uid() = vendor_id);
