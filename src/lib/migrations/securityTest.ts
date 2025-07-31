/**
 * Security Test for Migration System
 * 
 * This file demonstrates the security validation features
 * of the migration system. DO NOT USE IN PRODUCTION.
 */

import { SQLSecurityValidator } from './migrationRunner'

/**
 * Test the SQL security validator
 */
export function testSQLSecurity() {
  console.log('🔒 Testing SQL Security Validator...\n')

  // Test safe SQL operations
  const safeSQLs = [
    "CREATE TABLE test_table (id SERIAL PRIMARY KEY)",
    "ALTER TABLE profiles ADD COLUMN new_field VARCHAR(100)",
    "CREATE INDEX idx_email ON profiles(email)",
    "UPDATE profiles SET status = 'verified' WHERE id = '123'",
    "INSERT INTO logs (message) VALUES ('test')"
  ]

  console.log('✅ Testing Safe SQL Operations:')
  safeSQLs.forEach((sql, index) => {
    const result = SQLSecurityValidator.validateSQL(sql)
    console.log(`${index + 1}. ${result.valid ? 'PASS' : 'FAIL'}: ${sql.substring(0, 50)}...`)
  })

  console.log('\n❌ Testing Dangerous SQL Operations:')
  
  // Test dangerous SQL operations
  const dangerousSQLs = [
    "DROP DATABASE production",
    "TRUNCATE TABLE users",
    "DELETE FROM profiles WHERE 1=1",
    "UPDATE profiles SET password = 'hacked' WHERE 1=1",
    "CREATE USER hacker",
    "GRANT ALL PRIVILEGES ON DATABASE TO public",
    "EXECUTE 'DROP TABLE ' || table_name"
  ]

  dangerousSQLs.forEach((sql, index) => {
    const result = SQLSecurityValidator.validateSQL(sql)
    console.log(`${index + 1}. ${result.valid ? 'FAIL' : 'PASS'}: ${result.error}`)
  })

  console.log('\n📝 Testing SQL Sanitization:')
  
  // Test SQL sanitization
  const sensitiveSQL = `
    UPDATE users SET 
      password = 'secret123',
      secret_key = 'abc123',
      api_key = 'xyz789'
    WHERE id = 1
  `
  
  const sanitized = SQLSecurityValidator.sanitizeForLogging(sensitiveSQL)
  console.log('Original:', sensitiveSQL.substring(0, 100) + '...')
  console.log('Sanitized:', sanitized)
}

// Run test if this file is executed directly
if (require.main === module) {
  testSQLSecurity()
} 