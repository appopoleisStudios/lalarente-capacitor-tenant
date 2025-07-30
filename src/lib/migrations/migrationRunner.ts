import { supabase } from '../supabase'
import fs from 'fs'
import path from 'path'

/**
 * Migration Runner for Database Schema Updates
 * 
 * This utility helps execute database migrations safely
 * and provides rollback capabilities.
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
    } catch (error) {
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
        execution_time_ms INTEGER
      );
    `

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL })
      if (error) {
        console.error('Failed to create migrations table:', error)
      } else {
        console.log('Migrations table created successfully')
      }
    } catch (error) {
      console.error('Error creating migrations table:', error)
    }
  }

  /**
   * Execute a migration file
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

      // Execute migration
      const { error, count } = await supabase.rpc('exec_sql', { sql: sqlContent })

      if (error) {
        throw new Error(`Migration execution failed: ${error.message}`)
      }

      const executionTime = Date.now() - startTime

      // Record successful migration
      await this.recordMigration(migrationId, migrationName, true, undefined, executionTime)

      return {
        success: true,
        message: `Migration ${migrationId} executed successfully`,
        affectedRows: count || 0
      }

    } catch (error) {
      const executionTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Record failed migration
      await this.recordMigration(migrationId, migrationName, false, errorMessage, executionTime)

      return {
        success: false,
        message: `Migration ${migrationId} failed`,
        error: errorMessage
      }
    }
  }

  /**
   * Record migration execution in the migrations table
   */
  private async recordMigration(
    migrationId: string,
    name: string,
    success: boolean,
    errorMessage?: string,
    executionTime?: number
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
          execution_time_ms: executionTime
        })

      if (error) {
        console.error('Failed to record migration:', error)
      }
    } catch (error) {
      console.error('Error recording migration:', error)
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
   * Rollback a migration (if possible)
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

    } catch (error) {
      return {
        success: false,
        message: `Rollback failed for migration ${migrationId}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

export default MigrationRunner 