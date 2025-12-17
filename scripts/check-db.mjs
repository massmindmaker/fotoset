import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function check() {
  try {
    // Check indexes on users table
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'users' AND indexname LIKE '%telegram%'
    `;
    console.log('Telegram indexes:', JSON.stringify(indexes, null, 2));

    // Test insert with a test ID
    const testId = 999999999;
    console.log('\nTesting INSERT ON CONFLICT with telegram_user_id =', testId);

    const result = await sql`
      INSERT INTO users (telegram_user_id, device_id)
      VALUES (${testId}, ${'tg_' + testId})
      ON CONFLICT (telegram_user_id) DO UPDATE SET
        updated_at = NOW()
      RETURNING id, telegram_user_id
    `;
    console.log('Insert result:', JSON.stringify(result, null, 2));

    // Cleanup
    await sql`DELETE FROM users WHERE telegram_user_id = ${testId}`;
    console.log('Cleanup done');

  } catch (e) {
    console.error('Error:', e.message);
    console.error('Full error:', e);
  }
}

check();
