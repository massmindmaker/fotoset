#!/usr/bin/env node
/**
 * Run migration 052: Add partner test generation quota fields
 */
import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

// Load .env.local
config({ path: '.env.local' })

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

console.log('Running migration: 052_partner_test_quota.sql')
console.log('='.repeat(60))

try {
  // Add quota fields to referral_balances
  await sql`
    ALTER TABLE referral_balances 
    ADD COLUMN IF NOT EXISTS test_generations_limit INT DEFAULT 200
  `
  console.log('Added column: test_generations_limit')

  await sql`
    ALTER TABLE referral_balances 
    ADD COLUMN IF NOT EXISTS test_generations_used INT DEFAULT 0
  `
  console.log('Added column: test_generations_used')

  // Add comments
  await sql`
    COMMENT ON COLUMN referral_balances.test_generations_limit IS 'Maximum test generations allowed for partner (200 default)'
  `
  await sql`
    COMMENT ON COLUMN referral_balances.test_generations_used IS 'Number of test generations used by partner'
  `
  console.log('Added comments')

  // Create index for partner quota lookup
  await sql`
    CREATE INDEX IF NOT EXISTS idx_referral_balances_partner_quota 
    ON referral_balances(user_id) 
    WHERE is_partner = TRUE
  `
  console.log('Created index: idx_referral_balances_partner_quota')

  // Verify columns exist
  const check = await sql`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'referral_balances' 
    AND column_name IN ('test_generations_limit', 'test_generations_used')
  `
  
  console.log('='.repeat(60))
  console.log(`Migration completed! Found ${check.length} new columns`)
  console.log('Columns:', check.map(c => c.column_name).join(', '))
} catch (error) {
  console.error('Migration failed:', error.message)
  process.exit(1)
}
