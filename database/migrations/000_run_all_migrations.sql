-- Master Migration File - Property Rental Management
-- This file runs all migrations in the correct order
-- 
-- Usage:
--   psql -h <host> -U <user> -d <database> -f 000_run_all_migrations.sql
--
-- Or use Supabase CLI:
--   supabase db push

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "earthdistance" CASCADE;

-- Migration 001: Enhance properties table
\echo 'Running migration 001: Enhance properties table...'
\i 001_enhance_properties_table.sql

-- Migration 002: Create property_photos table
\echo 'Running migration 002: Create property_photos table...'
\i 002_create_property_photos_table.sql

-- Migration 003: Create property_amenities table
\echo 'Running migration 003: Create property_amenities table...'
\i 003_create_property_amenities_table.sql

-- Migration 004: Create viewing_requests table
\echo 'Running migration 004: Create viewing_requests table...'
\i 004_create_viewing_requests_table.sql

-- Migration 005: Create rental_applications table
\echo 'Running migration 005: Create rental_applications table...'
\i 005_create_rental_applications_table.sql

-- Migration 006: Enhance leases table
\echo 'Running migration 006: Enhance leases table...'
\i 006_enhance_leases_table.sql

-- Migration 007: Create payments table
\echo 'Running migration 007: Create payments table...'
\i 007_create_payments_table.sql

-- Migration 008: Create inspections table
\echo 'Running migration 008: Create inspections table...'
\i 008_create_inspections_table.sql

-- Migration 009: Create messages tables
\echo 'Running migration 009: Create messages tables...'
\i 009_create_messages_tables.sql

-- Migration 010: Create documents table
\echo 'Running migration 010: Create documents table...'
\i 010_create_documents_table.sql

\echo 'All migrations completed successfully!'
\echo ''
\echo 'Post-migration tasks:'
\echo '1. Run: SELECT migrate_property_amenities(); -- to migrate existing amenities'
\echo '2. Generate TypeScript types: npx supabase gen types typescript'
\echo '3. Review the README.md file for next steps'
