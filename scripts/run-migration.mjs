#!/usr/bin/env node
import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

console.log('🚀 Running migration: 014_remove_device_id.sql')
console.log('━'.repeat(60))

try {
  // Step 1: Check for orphaned users
  const orphanedCount = await sql`
    SELECT COUNT(*) as count FROM users WHERE telegram_user_id IS NULL
  `
  
  if (orphanedCount[0].count > 0) {
    throw new Error(`Cannot remove device_id: ${orphanedCount[0].count} users without telegram_user_id found`)
  }
  console.log('✓ Pre-check passed: No orphaned users')

  // Step 2: Drop indexes
  await sql`DROP INDEX IF EXISTS idx_users_device_id`
  console.log('✓ Dropped index: idx_users_device_id')

  // Step 3: Drop unique constraint
  await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_device_id_key`
  console.log('✓ Dropped constraint: users_device_id_key')

  // Step 4: Drop column
  await sql`ALTER TABLE users DROP COLUMN IF EXISTS device_id`
  console.log('✓ Dropped column: device_id')

  // Step 5: Add comment
  await sql`COMMENT ON COLUMN users.telegram_user_id IS 'Primary and ONLY identifier for users. All users must have Telegram account. UNIQUE.'`
  console.log('✓ Added comment to telegram_user_id')

  // Step 6: Ensure telegram_user_id is NOT NULL
  await sql`ALTER TABLE users ALTER COLUMN telegram_user_id SET NOT NULL`
  console.log('✓ Set telegram_user_id NOT NULL')

  // Step 7: Verify migration
  const deviceColumnExists = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'device_id'
    ) as exists
  `
  
  if (deviceColumnExists[0].exists) {
    throw new Error('Migration failed: device_id column still exists')
  }

  console.log('━'.repeat(60))
  console.log('✅ Migration completed successfully!')
  console.log('\n✨ device_id column removed')
  console.log('✨ telegram_user_id is now the ONLY identifier\n')
  console.log('🎉 Ready to test on production!')
} catch (error) {
  console.error('\n❌ Migration failed:', error.message)
  process.exit(1)
}
