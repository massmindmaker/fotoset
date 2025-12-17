require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function truncateAll() {
  console.log('🗑️  Truncating ALL tables...\n');

  // Disable foreign key checks and truncate all in one transaction
  await sql`
    TRUNCATE TABLE
      webhook_logs,
      telegram_sessions,
      telegram_message_queue,
      telegram_link_codes,
      shared_galleries,
      uploaded_photos,
      referral_withdrawals,
      referral_earnings,
      referral_balances,
      referral_codes,
      referrals,
      photo_favorites,
      reference_photos,
      generated_photos,
      generation_jobs,
      payments,
      avatars,
      users
    RESTART IDENTITY CASCADE
  `;

  console.log('✅ All tables truncated!\n');

  // Verify
  const check = await sql`SELECT COUNT(*) as c FROM users`;
  console.log('Users remaining:', check[0].c);
}

truncateAll().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
