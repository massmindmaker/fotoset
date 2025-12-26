import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function cleanTestData() {
  console.log('=== PinGlass Data Cleanup ===\n');
  console.log('WARNING: This will DELETE ALL data from the database!\n');

  try {
    // Order matters due to foreign key constraints!

    // 1. Clear referral earnings (depends on: referrer_id, referred_id, payment_id)
    console.log('1. Deleting referral_earnings...');
    const re = await sql`DELETE FROM referral_earnings RETURNING id`;
    console.log(`   Deleted ${re.length} rows`);

    // 2. Clear referral balances (depends on: user_id)
    console.log('2. Deleting referral_balances...');
    const rb = await sql`DELETE FROM referral_balances RETURNING id`;
    console.log(`   Deleted ${rb.length} rows`);

    // 3. Clear referrals (depends on: referrer_id, referred_id)
    console.log('3. Deleting referrals...');
    const r = await sql`DELETE FROM referrals RETURNING id`;
    console.log(`   Deleted ${r.length} rows`);

    // 4. Clear referral codes (depends on: user_id)
    console.log('4. Deleting referral_codes...');
    const rc = await sql`DELETE FROM referral_codes RETURNING id`;
    console.log(`   Deleted ${rc.length} rows`);

    // 5. Clear generated photos (depends on: avatar_id)
    console.log('5. Deleting generated_photos...');
    const gp = await sql`DELETE FROM generated_photos RETURNING id`;
    console.log(`   Deleted ${gp.length} rows`);

    // 6. Clear generation jobs (depends on: avatar_id, payment_id)
    console.log('6. Deleting generation_jobs...');
    const gj = await sql`DELETE FROM generation_jobs RETURNING id`;
    console.log(`   Deleted ${gj.length} rows`);

    // 7. Clear reference photos (depends on: avatar_id)
    console.log('7. Deleting reference_photos...');
    const rp = await sql`DELETE FROM reference_photos RETURNING id`;
    console.log(`   Deleted ${rp.length} rows`);

    // 8. Clear avatars (depends on: user_id)
    console.log('8. Deleting avatars...');
    const a = await sql`DELETE FROM avatars RETURNING id`;
    console.log(`   Deleted ${a.length} rows`);

    // 9. Clear payments (depends on: user_id)
    console.log('9. Deleting payments...');
    const p = await sql`DELETE FROM payments RETURNING id`;
    console.log(`   Deleted ${p.length} rows`);

    // 10. Clear users (no dependencies)
    console.log('10. Deleting users...');
    const u = await sql`DELETE FROM users RETURNING id`;
    console.log(`   Deleted ${u.length} rows`);

    console.log('\n=== Cleanup Complete ===');
    console.log('All tables cleared successfully!');

  } catch (e) {
    console.error('\nError during cleanup:', e.message);
    console.error('Full error:', e);
  }
}

cleanTestData();
