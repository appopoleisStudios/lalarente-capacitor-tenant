import { supabase } from '../supabase'
import fs from 'fs'
import path from 'path'

/**
 * Secure Migration Runner for Database Schema Updates
 * 
 * This utility helps execute database migrations safely
 * with proper security validation and audit logging.
 */

interface MigrationResult {
  success: boolean
  message: string
  error?: string
  affectedRows?: number
}

interface MigrationStatus {
  migrationId: string
  executed: boolean
  executedAt?: Date
  error?: string | null
}

// Type for the migrations table row
interface MigrationRow {
  id: number
  migration_id: string
  name: string
  executed_at: string
  success: boolean
  error_message: string | null
  execution_time_ms: number | null
}

/**
 * SQL Security Validator
 * Prevents dangerous SQL operations and validates migration patterns
 */
export class SQLSecurityValidator {
  // Allowed SQL operations for migrations
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

  // Dangerous patterns to block
  private static DANGEROUS_PATTERNS = [
    /DROP\s+DATABASE/i,
    /TRUNCATE\s+TABLE/i,
    /DELETE\s+FROM\s+.*\s+WHERE\s+1\s*=\s*1/i, // Mass deletion
    /UPDATE\s+.*\s+SET\s+.*\s+WHERE\s+1\s*=\s*1/i, // Mass update
    /CREATE\s+USER/i,
    /DROP\s+USER/i,
    /ALTER\s+USER/i,
    /CREATE\s+ROLE/i,
    /DROP\s+ROLE/i,
    /ALTER\s+ROLE/i,
    /GRANT\s+ALL\s+PRIVILEGES/i,
    /REVOKE\s+ALL\s+PRIVILEGES/i
  ]

  /**
   * Validate SQL for security
   */
  static validateSQL(sql: string): { valid: boolean; error?: string } {
    const normalizedSQL = sql.trim().toUpperCase()

    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(sql)) {
        return {
          valid: false,
          error: `Dangerous SQL pattern detected: ${pattern.source}`
        }
      }
    }

    // Check if SQL starts with allowed operation
    const hasAllowedOperation = this.ALLOWED_OPERATIONS.some(operation =>
      normalizedSQL.startsWith(operation)
    )

    if (!hasAllowedOperation) {
      return {
        valid: false,
        error: `SQL operation not allowed. Allowed operations: ${this.ALLOWED_OPERATIONS.join(', ')}`
      }
    }

    // Additional safety checks
    if (normalizedSQL.includes('EXEC') || normalizedSQL.includes('EXECUTE')) {
      return {
        valid: false,
        error: 'Dynamic SQL execution not allowed'
      }
    }

    return { valid: true }
  }

  /**
   * Sanitize SQL for logging (remove sensitive data)
   */
  static sanitizeForLogging(sql: string): string {
    return sql
      .replace(/password\s*=\s*['"][^'"]*['"]/gi, 'password=***')
      .replace(/secret\s*=\s*['"][^'"]*['"]/gi, 'secret=***')
      .replace(/key\s*=\s*['"][^'"]*['"]/gi, 'key=***')
      .substring(0, 500) // Limit length for logging
  }
}

/**
 * Secure Migration Runner
 */
class MigrationRunner {
  private migrationsTable = 'migrations' as const

  constructor() {
    this.ensureMigrationsTable()
  }

  /**
   * Ensure the migrations table exists
   */
  private async ensureMigrationsTable() {
    try {
      const { error } = await supabase
        .from(this.migrationsTable)
        .select('*')
        .limit(1)

      if (error && error.code === '42P01') { // Table doesn't exist
        await this.createMigrationsTable()
      }
    } catch {
      console.log('Migrations table check failed, creating...')
      await this.createMigrationsTable()
    }
  }

  /**
   * Create the migrations tracking table
   */
  private async createMigrationsTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
        id SERIAL PRIMARY KEY,
        migration_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(500) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        success BOOLEAN DEFAULT TRUE,
        error_message TEXT,
        execution_time_ms INTEGER,
        executed_by VARCHAR(255),
        sql_hash VARCHAR(64)
      );
    `

    // Validate the SQL before execution
    const validation = SQLSecurityValidator.validateSQL(createTableSQL)
    if (!validation.valid) {
      console.error('Migration table creation SQL validation failed:', validation.error)
      return
    }

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL })
      if (error) {
        console.error('Failed to create migrations table:', error)
      } else {
        console.log('Migrations table created successfully')
      }
    } catch {
      console.error('Error creating migrations table')
    }
  }

  /**
   * Execute a migration file with security validation
   */
  async runMigration(migrationId: string, migrationName: string): Promise<MigrationResult> {
    const startTime = Date.now()
    
    try {
      // Check if migration already executed
      const { data: existing } = await supabase
        .from(this.migrationsTable)
        .select('*')
        .eq('migration_id', migrationId)
        .single()

      if (existing && (existing as MigrationRow).success) {
        return {
          success: true,
          message: `Migration ${migrationId} already executed successfully`
        }
      }

      // Read migration SQL file
      const migrationPath = path.join(__dirname, `${migrationId}.sql`)
      const sqlContent = fs.readFileSync(migrationPath, 'utf8')

      // Validate SQL for security
      const validation = SQLSecurityValidator.validateSQL(sqlContent)
      if (!validation.valid) {
        throw new Error(`Migration SQL validation failed: ${validation.error}`)
      }

      // Get current user for audit logging
      const { data: { user } } = await supabase.auth.getUser()
      const executedBy = user?.email || 'system'

      // Log the migration attempt
      console.log(`Executing migration: ${migrationId}`)
      console.log(`Executed by: ${executedBy}`)
      console.log(`SQL preview: ${SQLSecurityValidator.sanitizeForLogging(sqlContent)}`)

      // Execute migration
      const { error, count } = await supabase.rpc('exec_sql', { sql: sqlContent })

      if (error) {
        throw new Error(`Migration execution failed: ${error.message}`)
      }

      const executionTime = Date.now() - startTime

      // Record successful migration with audit info
      await this.recordMigration(
        migrationId, 
        migrationName, 
        true, 
        undefined, 
        executionTime,
        executedBy,
        this.hashSQL(sqlContent)
      )

      return {
        success: true,
        message: `Migration ${migrationId} executed successfully`,
        affectedRows: count || 0
      }

    } catch {
      const executionTime = Date.now() - startTime
      const errorMessage = 'Unknown error'

      // Record failed migration
      await this.recordMigration(
        migrationId, 
        migrationName, 
        false, 
        errorMessage, 
        executionTime,
        'system',
        undefined
      )

      return {
        success: false,
        message: `Migration ${migrationId} failed`,
        error: errorMessage
      }
    }
  }

  /**
   * Record migration execution in the migrations table with audit info
   */
  private async recordMigration(
    migrationId: string,
    name: string,
    success: boolean,
    errorMessage?: string,
    executionTime?: number,
    executedBy?: string,
    sqlHash?: string
  ) {
    try {
      const { error } = await supabase
        .from(this.migrationsTable)
        .upsert({
          migration_id: migrationId,
          name,
          executed_at: new Date().toISOString(),
          success,
          error_message: errorMessage,
          execution_time_ms: executionTime,
          executed_by: executedBy,
          sql_hash: sqlHash
        })

      if (error) {
        console.error('Failed to record migration:', error)
      }
    } catch {
      console.error('Error recording migration')
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(migrationId: string): Promise<MigrationStatus | null> {
    try {
      const { data, error } = await supabase
        .from(this.migrationsTable)
        .select('*')
        .eq('migration_id', migrationId)
        .single()

      if (error) return null

      const migrationData = data as MigrationRow
      return {
        migrationId: migrationData.migration_id,
        executed: migrationData.success,
        executedAt: migrationData.executed_at ? new Date(migrationData.executed_at) : undefined,
        error: migrationData.error_message
      }
    } catch (error) {
      return null
    }
  }

  /**
   * List all migrations
   */
  async listMigrations(): Promise<MigrationStatus[]> {
    try {
      const { data, error } = await supabase
        .from(this.migrationsTable)
        .select('*')
        .order('executed_at', { ascending: true })

      if (error) return []

      return (data as MigrationRow[]).map(row => ({
        migrationId: row.migration_id,
        executed: row.success,
        executedAt: row.executed_at ? new Date(row.executed_at) : undefined,
        error: row.error_message
      }))
    } catch (error) {
      return []
    }
  }

  /**
   * Rollback a migration (if possible) with security validation
   */
  async rollbackMigration(migrationId: string): Promise<MigrationResult> {
    try {
      // Check if rollback SQL exists
      const rollbackPath = path.join(__dirname, `${migrationId}_rollback.sql`)
      
      if (!fs.existsSync(rollbackPath)) {
        return {
          success: false,
          message: `Rollback SQL file not found for migration ${migrationId}`
        }
      }

      const rollbackSQL = fs.readFileSync(rollbackPath, 'utf8')
      
      // Validate rollback SQL for security
      const validation = SQLSecurityValidator.validateSQL(rollbackSQL)
      if (!validation.valid) {
        return {
          success: false,
          message: `Rollback SQL validation failed: ${validation.error}`
        }
      }

      console.log(`Executing rollback for migration: ${migrationId}`)
      console.log(`SQL preview: ${SQLSecurityValidator.sanitizeForLogging(rollbackSQL)}`)
      
      const { error } = await supabase.rpc('exec_sql', { sql: rollbackSQL })

      if (error) {
        throw new Error(`Rollback failed: ${error.message}`)
      }

      // Remove migration record
      await supabase
        .from(this.migrationsTable)
        .delete()
        .eq('migration_id', migrationId)

      return {
        success: true,
        message: `Migration ${migrationId} rolled back successfully`
      }

    } catch {
      return {
        success: false,
        message: `Rollback failed for migration ${migrationId}`,
        error: 'Unknown error'
      }
    }
  }

  /**
   * Generate hash for SQL content (for audit purposes)
   */
  private hashSQL(sql: string): string {
    // Simple hash function for audit purposes
    let hash = 0
    for (let i = 0; i < sql.length; i++) {
      const char = sql.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }
}

export default MigrationRunner 