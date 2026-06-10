-- Add dev_admin flag to profiles table
-- This distinguishes between:
--   - superadmin (admin role, dev_admin = false) — business operations only
--   - dev admin (admin role, dev_admin = true) — full access including dev tools

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS dev_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.dev_admin IS 'If true, user has developer-level access to dev tools (Plane issues, env viewer, Sentry toggle). Only meaningful when role = ''admin''.';
