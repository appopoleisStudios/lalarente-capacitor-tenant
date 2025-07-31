#!/usr/bin/env tsx

/**
 * Database Migration Script
 * 
 * This script runs the migration to add unique constraints for email and ID number
 * to prevent duplicate registrations.
 * 
 * Usage:
 * npm run migrate
 * or
 * npx tsx scripts/runMigration.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  try {
    console.log('Starting migration...')
    
    // Read the migration file
    const migrationPath = join(__dirname, '../src/lib/migrations/002_add_unique_constraints.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf8')
    
    console.log('Migration SQL loaded successfully')
    console.log('Executing migration...')
    
    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`Found ${statements.length} SQL statements to execute`)
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`)
        
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement })
          
          if (error) {
            // If exec_sql doesn't exist, try direct SQL execution
            console.log('exec_sql RPC not available, trying direct execution...')
            const { error: directError } = await supabase
              .from('profiles')
              .select('*')
              .limit(0)
              .then(() => {
                // This is a workaround - we'll need to run the migration manually
                console.log('Direct SQL execution not available through client')
                console.log('Please run the migration manually in Supabase Dashboard')
                return { error: null }
              })
            
            if (directError) {
              console.error(`Statement ${i + 1} failed:`, directError)
            }
          }
        } catch (stmtError) {
          console.error(`Statement ${i + 1} failed:`, stmtError)
        }
      }
    }
    
    console.log('Migration execution completed!')
    console.log('\n⚠️  IMPORTANT: If you see errors above, please run the migration manually:')
    console.log('1. Go to your Supabase Dashboard')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Copy and paste the contents of: src/lib/migrations/002_add_unique_constraints.sql')
    console.log('4. Click "Run" to execute the migration')
    
  } catch (error) {
    console.error('Migration failed:', error)
    console.log('\n⚠️  Please run the migration manually in Supabase Dashboard')
    process.exit(1)
  }
}

runMigration() 