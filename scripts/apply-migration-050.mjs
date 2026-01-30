// Apply migration 050: Referral Performance Indexes
import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

async function applyMigration() {
  console.log('Applying migration 050_referral_performance_indexes.sql...\n')

  try {
    // 1. idx_referral_codes_user_active
    console.log('Creating idx_referral_codes_user_active...')
    await sql`
      CREATE INDEX IF NOT EXISTS idx_referral_codes_user_active
      ON referral_codes(user_id, is_active)
      WHERE is_active = true
    `
    console.log('  OK')

    // 2. idx_referral_codes_code_unique
    console.log('Creating idx_referral_codes_code_unique...')
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_code_unique
      ON referral_codes(code)
    `
    console.log('  OK')

    // 3. idx_referral_balances_user_id
    console.log('Creating idx_referral_balances_user_id...')
    await sql`
      CREATE INDEX IF NOT EXISTS idx_referral_balances_user_id
      ON referral_balances(user_id)
    `
    console.log('  OK')

    // 4. idx_referral_withdrawals_user_pending
    console.log('Creating idx_referral_withdrawals_user_pending...')
    await sql`
      CREATE INDEX IF NOT EXISTS idx_referral_withdrawals_user_pending
      ON referral_withdrawals(user_id, status)
      WHERE status IN ('pending', 'processing')
    `
    console.log('  OK')

    // 5. idx_referral_withdrawals_created
    console.log('Creating idx_referral_withdrawals_created...')
    await sql`
      CREATE INDEX IF NOT EXISTS idx_referral_withdrawals_created
      ON referral_withdrawals(user_id, created_at DESC)
    `
    console.log('  OK')

    // 6. idx_referrals_referrer_recent
    console.log('Creating idx_referrals_referrer_recent...')
    await sql`
      CREATE INDEX IF NOT EXISTS idx_referrals_referrer_recent
      ON referrals(referrer_id, created_at DESC)
    `
    console.log('  OK')

    console.log('\nMigration 050 applied successfully!')
  } catch (error) {
    console.error('\nMigration failed:', error.message)
    process.exit(1)
  }
}

applyMigration()
