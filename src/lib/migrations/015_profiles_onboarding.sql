-- Add onboarding completion flags to profiles (DB-first)

alter table if exists public.profiles
  add column if not exists onboarding_owner_done boolean not null default false,
  add column if not exists onboarding_tenant_done boolean not null default false,
  add column if not exists onboarding_vendor_done boolean not null default false;

-- No policy changes required; flags inherit existing RLS on profiles
