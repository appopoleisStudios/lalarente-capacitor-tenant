# Duplicate Prevention Implementation

## Overview

This document outlines the implementation of duplicate prevention for email addresses and national ID numbers in the Lala Rente registration system.

## Problem Statement

Previously, the system allowed multiple users to register with:
- The same email address
- The same national ID number

This could lead to:
- Account confusion and security issues
- Identity verification problems
- Data integrity issues

## Solution Implementation

### 1. Database-Level Constraints

#### Migration: `002_add_unique_constraints.sql`

- **Email Uniqueness**: Added unique index on `profiles.email` column
- **ID Number Uniqueness**: Created database triggers to prevent duplicate ID numbers in `fica_documents.id_number`
- **Email Format Validation**: Added trigger to validate email format
- **Performance Indexes**: Created GIN indexes for efficient JSON field queries

#### Key Database Functions:

```sql
-- Check for duplicate ID numbers
check_duplicate_id_number(new_id_number TEXT, exclude_user_id UUID)

-- Prevent duplicate ID numbers on insert/update
prevent_duplicate_id_number()

-- Validate email format
validate_email_format(email TEXT)
```

### 2. Application-Level Validation

#### Auth Store Functions (`src/store/authStore.ts`)

Added two new validation functions:

```typescript
checkEmailExists: (email: string) => Promise<boolean>
checkIdNumberExists: (idNumber: string) => Promise<boolean>
```

#### Registration Flow Updates

Both `signUpOwner` and `signUpTenant` now include:

1. **Pre-registration validation** for email and ID number duplicates
2. **User-friendly error messages** for duplicate entries
3. **Email field population** in profiles table

### 3. Error Handling

#### Email Duplicate Error:
```
"This email address is already registered. Please use a different email or try signing in."
```

#### ID Number Duplicate Error:
```
"This ID number is already registered. Please use a different ID number or contact support if this is an error."
```

## Implementation Details

### Email Validation

1. **Supabase Auth Check**: Verifies if email exists in `auth.users`
2. **Profiles Table Check**: Verifies if email exists in `profiles.email`
3. **Unique Constraint**: Database-level unique index prevents duplicates

### ID Number Validation

1. **JSON Field Query**: Searches `fica_documents.id_number` across all profiles
2. **Database Trigger**: Prevents duplicate ID numbers at database level
3. **Application Check**: Validates before registration attempt

### Database Schema Updates

#### Profiles Table
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
CREATE UNIQUE INDEX idx_profiles_email_unique ON profiles (email) WHERE email IS NOT NULL;
```

#### FICA Documents
```sql
-- Trigger to prevent duplicate ID numbers
CREATE TRIGGER trigger_prevent_duplicate_id_number
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_duplicate_id_number();
```

## Security Considerations

1. **Data Privacy**: ID numbers are stored securely in JSON fields
2. **Error Messages**: Generic error messages don't reveal existing data
3. **Rate Limiting**: Consider implementing rate limiting for validation checks
4. **Audit Trail**: Database triggers provide audit trail for duplicate attempts

## Testing Scenarios

### Email Duplication Tests
- [ ] Try to register with existing email address
- [ ] Verify error message is displayed
- [ ] Verify no duplicate user is created

### ID Number Duplication Tests
- [ ] Try to register with existing ID number
- [ ] Verify error message is displayed
- [ ] Verify no duplicate profile is created

### Edge Cases
- [ ] Case sensitivity in email addresses
- [ ] Whitespace handling in ID numbers
- [ ] Special characters in email addresses
- [ ] Null/empty value handling

## Migration Instructions

1. **Run Database Migration**:
   ```sql
   -- Execute the migration in Supabase SQL Editor
   -- File: src/lib/migrations/002_add_unique_constraints.sql
   ```

2. **Deploy Application Changes**:
   - Updated auth store with validation functions
   - Updated registration flows
   - Updated TypeScript types

3. **Test Registration Flows**:
   - Test tenant registration with duplicate email/ID
   - Test owner registration with duplicate email/ID
   - Verify error messages are user-friendly

## Monitoring and Maintenance

### Database Monitoring
- Monitor for trigger execution errors
- Track duplicate attempt patterns
- Monitor index performance

### Application Monitoring
- Log validation check failures
- Monitor registration success rates
- Track error message frequency

## Future Enhancements

1. **Rate Limiting**: Implement rate limiting for validation checks
2. **Admin Interface**: Add admin tools to manage duplicate cases
3. **Bulk Validation**: Add bulk validation for data migration
4. **Enhanced Logging**: Add detailed logging for security audits

## Rollback Plan

If issues arise, the following can be rolled back:

1. **Database Rollback**:
   ```sql
   -- Drop triggers and functions
   DROP TRIGGER IF EXISTS trigger_prevent_duplicate_id_number ON profiles;
   DROP TRIGGER IF EXISTS trigger_validate_email_format ON profiles;
   DROP FUNCTION IF EXISTS prevent_duplicate_id_number();
   DROP FUNCTION IF EXISTS validate_email_format();
   DROP FUNCTION IF EXISTS check_duplicate_id_number();
   
   -- Drop indexes
   DROP INDEX IF EXISTS idx_profiles_email_unique;
   DROP INDEX IF EXISTS idx_profiles_fica_documents_id_number;
   
   -- Remove email column (if needed)
   ALTER TABLE profiles DROP COLUMN IF EXISTS email;
   ```

2. **Application Rollback**:
   - Revert auth store changes
   - Remove validation function calls
   - Update TypeScript types

## Support and Troubleshooting

### Common Issues

1. **Trigger Errors**: Check database logs for trigger execution errors
2. **Performance Issues**: Monitor index usage and query performance
3. **Validation Failures**: Check application logs for validation errors

### Contact Information

For issues related to duplicate prevention:
- Database issues: Check Supabase logs
- Application issues: Check application error logs
- Security concerns: Contact development team 