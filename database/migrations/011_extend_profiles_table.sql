-- Migration: Extend profiles table with tenant application fields
-- Description: Add fields needed for tenant applications and profile management
-- Date: 2024-12-03

-- Add new columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS id_number TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS employer TEXT,
ADD COLUMN IF NOT EXISTS position TEXT,
ADD COLUMN IF NOT EXISTS monthly_income NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS employment_start_date DATE,
ADD COLUMN IF NOT EXISTS employer_contact TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.id_number IS 'National ID or passport number';
COMMENT ON COLUMN public.profiles.date_of_birth IS 'Date of birth for age verification';
COMMENT ON COLUMN public.profiles.employer IS 'Current employer name';
COMMENT ON COLUMN public.profiles.position IS 'Job title/position';
COMMENT ON COLUMN public.profiles.monthly_income IS 'Gross monthly income for affordability checks';
COMMENT ON COLUMN public.profiles.employment_start_date IS 'Employment start date';
COMMENT ON COLUMN public.profiles.employer_contact IS 'HR contact for employment verification';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_id_number ON public.profiles(id_number);

-- Note: RLS policies already exist on profiles table and will apply to these new columns
