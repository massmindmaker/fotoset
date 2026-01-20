#!/usr/bin/env node
/**
 * Run Migration 048: Dual Referral Codes
 * Usage: node scripts/run-migration-048.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { neon } from '@neondatabase/serverless'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function runMigration() {
  // Read DATABASE_URL from environment
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set')
    console.error('Please set it in your .env.local file or environment')
    process.exit(1)
  }

  console.log('🔄 Running Migration 048: Dual Referral Codes...')

  const sql = neon(databaseUrl)

  try {
    // Read migration file
    const migrationPath = join(__dirname, 'migrations', '048_dual_referral_codes.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')

    console.log('📄 Migration file loaded')
    console.log('📊 Executing migration SQL...')

    // Parse and execute statements
    const lines = migrationSQL.split('\n')
    let currentStatement = ''
    let statementCount = 0

    for (const line of lines) {
      const trimmed = line.trim()

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('--')) {
        continue
      }

      currentStatement += line + '\n'

      // Check if statement is complete (ends with semicolon)
      if (trimmed.endsWith(';')) {
        statementCount++
        const stmt = currentStatement.trim()
        console.log(`  ${statementCount}: ${stmt.substring(0, 60).replace(/\n/g, ' ')}...`)

        try {
          // Use sql.unsafe for raw SQL execution
          await sql.unsafe(stmt)
        } catch (err) {
          // Ignore "already exists" errors for idempotency
          if (err.message && (
            err.message.includes('already exists') ||
            err.message.includes('duplicate key')
          )) {
            console.log(`    ⚠️  Already exists, skipping`)
          } else {
            throw err
          }
        }

        currentStatement = ''
      }
    }

    console.log('✅ Migration 048 completed successfully!')
    console.log('')
    console.log('Verification:')

    // Verify new columns exist
    const columns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'referral_balances'
        AND column_name LIKE 'referral_code%'
      ORDER BY column_name
    `

    console.log('📋 Columns:', columns.map(c => c.column_name).join(', '))

    // Check indexes
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'referral_balances'
        AND indexname LIKE 'idx_referral%'
      ORDER BY indexname
    `

    console.log('🔍 Indexes:', indexes.map(i => i.indexname).join(', '))

    // Check migrated codes (first 3 rows)
    const codes = await sql`
      SELECT user_id, referral_code, referral_code_telegram, referral_code_web
      FROM referral_balances
      LIMIT 3
    `

    if (codes.length > 0) {
      console.log('📊 Sample migrated codes:')
      codes.forEach(c => {
        console.log(`  User ${c.user_id}: legacy=${c.referral_code || 'null'}, tg=${c.referral_code_telegram || 'null'}, web=${c.referral_code_web || 'null'}`)
      })
    } else {
      console.log('ℹ️  No existing referral codes to migrate')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

runMigration()
