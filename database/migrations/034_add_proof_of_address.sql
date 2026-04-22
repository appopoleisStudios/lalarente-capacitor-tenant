-- Migration 034: Add proof of address fields to profiles
-- Required for tenant profile completion gate before applying for properties

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS proof_of_address_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS utility_account_number TEXT;
