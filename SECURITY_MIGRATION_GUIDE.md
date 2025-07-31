# Security Guide: Database Migration System

## Overview

This document outlines the security measures implemented in the Lala Rente database migration system to address the significant security risks associated with the `exec_sql` RPC function.

## Security Risks Addressed

### 1. **Arbitrary SQL Execution**
- **Risk**: The `exec_sql` function could execute any SQL, including destructive operations
- **Solution**: Implemented SQL validation that only allows safe migration operations

### 2. **SQL Injection Vulnerabilities**
- **Risk**: Malicious SQL could be injected through migration files
- **Solution**: Strict validation of SQL patterns and content before execution

### 3. **Unauthorized Access**
- **Risk**: Anyone with database access could execute dangerous operations
- **Solution**: Authentication checks and audit logging for all operations

### 4. **Data Corruption**
- **Risk**: Accidental or malicious data destruction
- **Solution**: Pattern matching to block dangerous operations

## Security Implementation

### SQL Security Validator

The `SQLSecurityValidator` class implements multiple layers of security:

#### Allowed Operations
```typescript
private static ALLOWED_OPERATIONS = [
  'CREATE TABLE',
  'ALTER TABLE', 
  'DROP TABLE',
  'CREATE INDEX',
  'DROP INDEX',
  'CREATE VIEW',
  'DROP VIEW',
  'INSERT INTO',
  'UPDATE',
  'DELETE FROM',
  'GRANT',
  'REVOKE',
  'COMMENT ON'
]
```

#### Blocked Dangerous Patterns
```typescript
private static DANGEROUS_PATTERNS = [
  /DROP\s+DATABASE/i,                    // Database destruction
  /TRUNCATE\s+TABLE/i,                   // Mass data deletion
  /DELETE\s+FROM\s+.*\s+WHERE\s+1\s*=\s*1/i,  // Mass deletion
  /UPDATE\s+.*\s+SET\s+.*\s+WHERE\s+1\s*=\s*1/i,  // Mass update
  /CREATE\s+USER/i,                      // User creation
  /DROP\s+USER/i,                        // User deletion
  /ALTER\s+USER/i,                       // User modification
  /CREATE\s+ROLE/i,                      // Role creation
  /DROP\s+ROLE/i,                        // Role deletion
  /ALTER\s+ROLE/i,                       // Role modification
  /GRANT\s+ALL\s+PRIVILEGES/i,           // Broad privilege grants
  /REVOKE\s+ALL\s+PRIVILEGES/i           // Broad privilege revokes
]
```

### Validation Process

1. **Pattern Matching**: Checks for dangerous SQL patterns
2. **Operation Validation**: Ensures SQL starts with allowed operations
3. **Dynamic SQL Blocking**: Prevents execution of dynamic SQL
4. **Content Sanitization**: Removes sensitive data from logs

### Audit Logging

All migration operations are logged with:
- **User identification**: Who executed the migration
- **SQL hash**: Cryptographic hash of the SQL content
- **Execution time**: Performance monitoring
- **Success/failure status**: Operation outcome
- **Sanitized SQL preview**: Safe logging without sensitive data

## Database-Level Security

### Required Supabase Configuration

Ensure your Supabase project has these security policies:

```sql
-- Restrict exec_sql function to authenticated users only
CREATE POLICY "exec_sql_auth_policy" ON FUNCTION exec_sql
  FOR ALL TO authenticated
  USING (true);

-- Deny access to unauthenticated users
CREATE POLICY "exec_sql_deny_anon" ON FUNCTION exec_sql
  FOR ALL TO anon
  USING (false);

-- Log all exec_sql calls
CREATE OR REPLACE FUNCTION log_exec_sql()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    operation,
    sql_content_hash,
    executed_by,
    executed_at
  ) VALUES (
    'exec_sql',
    encode(sha256(NEW.sql::bytea), 'hex'),
    current_user,
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Row Level Security (RLS)

```sql
-- Enable RLS on migrations table
ALTER TABLE migrations ENABLE ROW LEVEL SECURITY;

-- Only allow users to see their own migrations
CREATE POLICY "migrations_user_policy" ON migrations
  FOR ALL TO authenticated
  USING (executed_by = current_user OR current_user = 'admin');
```

## Usage Guidelines

### Safe Migration Patterns

✅ **Allowed**:
```sql
-- Create new table
CREATE TABLE new_feature (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255)
);

-- Add column to existing table
ALTER TABLE profiles ADD COLUMN new_field VARCHAR(100);

-- Create index
CREATE INDEX idx_profiles_email ON profiles(email);

-- Update data with specific conditions
UPDATE profiles SET status = 'verified' WHERE id = 'specific-id';
```

❌ **Blocked**:
```sql
-- Mass deletion (blocked)
DELETE FROM profiles WHERE 1=1;

-- Database destruction (blocked)
DROP DATABASE production;

-- User management (blocked)
CREATE USER hacker;

-- Dynamic SQL (blocked)
EXECUTE 'DROP TABLE ' || table_name;
```

### Migration File Security

1. **File Location**: Store migration files in `src/lib/migrations/`
2. **File Naming**: Use descriptive names with version numbers
3. **Content Review**: All SQL must be reviewed before deployment
4. **Version Control**: Track all changes in Git

## Monitoring and Alerting

### Log Monitoring

Monitor these log patterns:
- Failed SQL validations
- Unusual migration patterns
- High-frequency migration attempts
- Access from unexpected users

### Alerting Rules

```yaml
# Example alerting configuration
alerts:
  - name: "Dangerous SQL Attempt"
    condition: "sql_validation_failed"
    severity: "high"
    
  - name: "Mass Data Operation"
    condition: "mass_delete_or_update"
    severity: "critical"
    
  - name: "Unauthorized Migration"
    condition: "unauthenticated_migration_attempt"
    severity: "high"
```

## Incident Response

### If Security Breach Detected

1. **Immediate Actions**:
   - Disable `exec_sql` function
   - Review audit logs
   - Identify affected data
   - Notify security team

2. **Investigation**:
   - Analyze SQL patterns
   - Check user access logs
   - Review migration history
   - Assess data integrity

3. **Recovery**:
   - Restore from backup if needed
   - Implement additional security measures
   - Update access controls
   - Document lessons learned

## Best Practices

### For Developers

1. **Always validate SQL** before committing
2. **Use specific conditions** instead of broad patterns
3. **Test migrations** in development first
4. **Review migration logs** regularly
5. **Keep migrations atomic** and reversible

### For Administrators

1. **Monitor migration logs** daily
2. **Review access patterns** weekly
3. **Update security policies** as needed
4. **Backup before migrations** always
5. **Document all changes** thoroughly

## Compliance

This implementation addresses:

- **OWASP Top 10**: SQL Injection prevention
- **GDPR**: Data protection and audit trails
- **SOC 2**: Security controls and monitoring
- **ISO 27001**: Information security management

## Support

For security concerns or questions:

1. **Review this documentation**
2. **Check the audit logs**
3. **Contact the security team**
4. **Report incidents immediately**

---

**Last Updated**: $(date)
**Version**: 1.0
**Security Level**: High 