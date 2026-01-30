// Check referral indexes
import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

async function checkIndexes() {
  console.log('Checking referral indexes...\n')

  const indexes = await sql`
    SELECT indexname, tablename
    FROM pg_indexes
    WHERE tablename IN ('referral_codes', 'referral_balances', 'referral_withdrawals', 'referrals')
    ORDER BY tablename, indexname
  `

  console.log('Existing indexes:')
  for (const idx of indexes) {
    console.log(`  ${idx.tablename}: ${idx.indexname}`)
  }

  // Check for our new indexes
  const expectedIndexes = [
    'idx_referral_codes_user_active',
    'idx_referral_codes_code_unique',
    'idx_referral_balances_user_id',
    'idx_referral_withdrawals_user_pending',
    'idx_referral_withdrawals_created',
    'idx_referrals_referrer_recent'
  ]

  console.log('\nMissing indexes from migration 050:')
  const existingNames = new Set(indexes.map(i => i.indexname))
  const missing = expectedIndexes.filter(n => !existingNames.has(n))

  if (missing.length === 0) {
    console.log('  All indexes exist!')
  } else {
    for (const m of missing) {
      console.log(`  MISSING: ${m}`)
    }
  }
}

checkIndexes().catch(e => console.error('Error:', e.message))
