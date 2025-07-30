#!/usr/bin/env tsx

/**
 * Database Migration Script
 * 
 * This script runs the migration to update the FICA documents schema
 * from document_url to document_path for secure document handling.
 * 
 * Usage:
 * npm run migrate
 * or
 * npx tsx scripts/runMigration.ts
 */

import MigrationRunner from '../src/lib/migrations/migrationRunner'

async function runMigration() {
  console.log('🚀 Starting Database Migration...')
  console.log('📋 Migration: Update FICA Documents Schema')
  console.log('🔒 Purpose: Change document_url to document_path for security')
  console.log('')

  const runner = new MigrationRunner()

  try {
    // Check current migration status
    console.log('📊 Checking migration status...')
    const status = await runner.getMigrationStatus('001_update_fica_documents_schema')
    
    if (status?.executed) {
      console.log('✅ Migration already executed successfully')
      console.log(`   Executed at: ${status.executedAt}`)
      return
    }

    if (status?.error) {
      console.log('⚠️  Previous migration attempt failed:')
      console.log(`   Error: ${status.error}`)
      console.log('🔄 Retrying migration...')
    }

    // Run the migration
    console.log('🔄 Executing migration...')
    const result = await runner.runMigration(
      '001_update_fica_documents_schema',
      'Update FICA Documents Schema - Change document_url to document_path'
    )

    if (result.success) {
      console.log('✅ Migration completed successfully!')
      console.log(`   Message: ${result.message}`)
      if (result.affectedRows) {
        console.log(`   Affected rows: ${result.affectedRows}`)
      }
    } else {
      console.log('❌ Migration failed!')
      console.log(`   Error: ${result.error}`)
      process.exit(1)
    }

    // Show final status
    console.log('')
    console.log('📊 Final migration status:')
    const finalStatus = await runner.getMigrationStatus('001_update_fica_documents_schema')
    if (finalStatus) {
      console.log(`   Status: ${finalStatus.executed ? '✅ Executed' : '❌ Failed'}`)
      console.log(`   Executed at: ${finalStatus.executedAt}`)
      if (finalStatus.error) {
        console.log(`   Error: ${finalStatus.error}`)
      }
    }

    console.log('')
    console.log('🎉 Migration process completed!')
    console.log('')
    console.log('📝 Next steps:')
    console.log('   1. Test the application to ensure documents load correctly')
    console.log('   2. Verify that new registrations use document_path')
    console.log('   3. Update any UI components to use SecureDocumentViewer')
    console.log('   4. Consider removing old public URLs from storage')

  } catch (error) {
    console.error('💥 Unexpected error during migration:', error)
    process.exit(1)
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
}) 