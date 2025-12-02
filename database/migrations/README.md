# Database Migrations - Property Rental Management

This directory contains SQL migration files for the Property Rental Management system.

## Migration Files

### Core Schema Migrations

1. **001_enhance_properties_table.sql**
   - Adds rental-specific fields to properties table
   - Adds size_sqm, available_from, minimum_lease_months
   - Adds pets_allowed, smoking_allowed flags
   - Updates status enum (occupied → rented)
   - Adds view_count, inquiry_count, application_count
   - Creates performance indexes

2. **002_create_property_photos_table.sql**
   - Creates property_photos table for property images
   - Supports multiple photos per property with ordering
   - Includes RLS policies for access control

3. **003_create_property_amenities_table.sql**
   - Creates property_amenities table (normalized from JSON)
   - Includes migration function to move existing amenities
   - Supports amenity-based property search

4. **004_create_viewing_requests_table.sql**
   - Creates viewing_requests table for property tours
   - Tracks viewing status and scheduling
   - Supports alternative time proposals

5. **005_create_rental_applications_table.sql**
   - Creates rental_applications table
   - Stores applicant information and documents
   - Includes screening fields (background, credit, identity)
   - Creates co_applicants table for roommates
   - Includes affordability calculation function

6. **006_enhance_leases_table.sql**
   - Enhances existing leases table
   - Adds payment terms and rent escalation
   - Adds e-signature fields
   - Creates lease_addendums table for modifications
   - Includes auto-execution trigger when both parties sign

7. **007_create_payments_table.sql**
   - Creates payments table for all transactions
   - Creates payment_schedules for recurring rent
   - Creates refunds table for deposit returns
   - Includes retry logic for failed payments
   - Auto-creates payment schedule when lease activates

8. **008_create_inspections_table.sql**
   - Creates inspections table (move-in, periodic, move-out)
   - Creates inspection_photos table
   - Creates key_handovers table for access tracking
   - Includes auto-completion trigger when both parties sign

9. **009_create_messages_tables.sql**
   - Creates message_threads table for conversations
   - Creates messages table for individual messages
   - Creates message_attachments table
   - Includes triggers for unread count management

10. **010_create_documents_table.sql**
    - Creates documents table with access control
    - Creates document_access_log for audit trail
    - Creates property_waitlist table
    - Includes retention policy functions
    - Auto-calculates deletion dates

## Running Migrations

### Using Supabase CLI

```bash
# Run all migrations
supabase db push

# Or run individual migrations
psql -h <host> -U <user> -d <database> -f 001_enhance_properties_table.sql
```

### Migration Order

Migrations must be run in numerical order (001 → 010) due to foreign key dependencies.

## Post-Migration Tasks

### 1. Migrate Existing Amenities

After running migration 003, execute the migration function:

```sql
SELECT migrate_property_amenities();
```

This will move amenities from the `properties.amenities` JSON field to the normalized `property_amenities` table.

### 2. Update Existing Property Status

If you have properties with status 'occupied', they will be automatically updated to 'rented' by migration 001.

### 3. Enable PostGIS (Optional)

For location-based searches, ensure PostGIS extension is enabled:

```sql
CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE;
```

## Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:

- **Owners** can access data for their properties
- **Tenants** can access data for their applications and leases
- **Public** can view available properties
- **Audit logs** track all document access

## Key Features

### Automatic Triggers

- **Lease Execution**: Automatically marks lease as active when both parties sign
- **Property Status**: Updates property to 'rented' when lease executes
- **Payment Schedule**: Creates recurring payment schedule when lease activates
- **Inspection Completion**: Marks inspection complete when both parties sign
- **Message Unread Counts**: Automatically updates unread message counts
- **Document Retention**: Calculates deletion dates based on retention period

### Helper Functions

- `calculate_affordability_ratio(rent, income)` - Calculates rent-to-income ratio
- `calculate_document_delete_after(years, created_at)` - Calculates deletion date
- `log_document_access(document_id, ip, user_agent)` - Logs document access
- `get_documents_for_deletion()` - Returns documents due for deletion
- `delete_expired_documents()` - Deletes expired documents
- `migrate_property_amenities()` - Migrates amenities from JSON to table

## Database Schema Overview

```
properties (enhanced)
├── property_photos
├── property_amenities
├── property_waitlist
├── viewing_requests
├── rental_applications
│   └── co_applicants
├── leases (enhanced)
│   ├── lease_addendums
│   ├── payments
│   │   ├── payment_schedules
│   │   └── refunds
│   ├── inspections
│   │   ├── inspection_photos
│   │   └── key_handovers
│   └── message_threads
│       ├── messages
│       └── message_attachments
└── documents
    └── document_access_log
```

## Requirements Coverage

These migrations implement the database schema for:

- **Requirement 1**: Property Listing Creation
- **Requirement 2**: Property Listing Management
- **Requirement 3**: Property Search and Discovery
- **Requirement 4**: Property Detail View
- **Requirement 5**: Property Viewing Scheduling
- **Requirement 6**: Rental Application Submission
- **Requirement 7**: Application Review and Screening (partial)
- **Requirement 8**: Lease Agreement Creation
- **Requirement 9**: Lease Signing and Execution
- **Requirement 10**: Move-In Process
- **Requirement 11**: Rent Payment Management
- **Requirement 12**: Owner Rent Collection Dashboard
- **Requirement 13**: Tenant-Owner Communication
- **Requirement 16**: Move-Out Process
- **Requirement 19**: Document Management

## Next Steps

After running these migrations:

1. Generate TypeScript types: `npx supabase gen types typescript`
2. Implement API layer in `src/features/rental/api/`
3. Create React Native screens for owner and tenant flows
4. Integrate payment gateways (PayFast, Yoco)
5. Implement notification system
6. Set up document storage in Supabase Storage

## Notes

- All timestamps use `TIMESTAMPTZ` for timezone awareness
- All monetary values use `DECIMAL(10, 2)` for precision
- All IDs use `UUID` for security and scalability
- JSONB is used for flexible data structures (rooms, rental history, etc.)
- Indexes are created for all foreign keys and common query patterns
- Constraints ensure data integrity (positive amounts, valid dates, etc.)

## Support

For questions or issues with migrations, refer to:
- Design document: `.kiro/specs/property-rental-management/design.md`
- Requirements document: `.kiro/specs/property-rental-management/requirements.md`
- Tasks document: `.kiro/specs/property-rental-management/tasks.md`
