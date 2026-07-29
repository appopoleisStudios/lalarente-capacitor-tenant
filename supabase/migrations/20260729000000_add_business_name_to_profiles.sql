-- Add business_name column to profiles for vendor registration
-- Vendors can register with a business/trading name
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_name text;
