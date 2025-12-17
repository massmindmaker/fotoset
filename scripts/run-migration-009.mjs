import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  console.log('Running migration 009_fix_telegram_constraint...');

  try {
    // Drop the partial index that doesn't work with ON CONFLICT
    console.log('Dropping partial index...');
    await sql`DROP INDEX IF EXISTS idx_users_telegram_unique`;
    console.log('✓ Dropped idx_users_telegram_unique');

    // Drop constraint if exists
    console.log('Dropping old constraint if exists...');
    try {
      await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_telegram_user_id_unique`;
      console.log('✓ Dropped old constraint');
    } catch (e) {
      console.log('No old constraint to drop');
    }

    // Create proper UNIQUE CONSTRAINT
    console.log('Creating UNIQUE CONSTRAINT...');
    await sql`ALTER TABLE users ADD CONSTRAINT users_telegram_user_id_unique UNIQUE (telegram_user_id)`;
    console.log('✓ Created users_telegram_user_id_unique constraint');

    // Verify
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'users' AND indexname LIKE '%telegram%'
    `;
    console.log('\nVerification - Telegram indexes:', JSON.stringify(indexes, null, 2));

    // Test ON CONFLICT
    console.log('\nTesting ON CONFLICT...');
    const testId = 999999999;
    const result = await sql`
      INSERT INTO users (telegram_user_id, device_id)
      VALUES (${testId}, ${'tg_' + testId})
      ON CONFLICT (telegram_user_id) DO UPDATE SET
        updated_at = NOW()
      RETURNING id, telegram_user_id
    `;
    console.log('✓ ON CONFLICT works! Result:', JSON.stringify(result, null, 2));

    // Cleanup
    await sql`DELETE FROM users WHERE telegram_user_id = ${testId}`;
    console.log('✓ Cleanup done');

    console.log('\n✅ Migration 009 completed successfully!');

  } catch (e) {
    console.error('Migration failed:', e.message);
    console.error('Full error:', e);
    process.exit(1);
  }
}

runMigration();
