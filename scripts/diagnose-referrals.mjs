import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function diagnose() {
  console.log('=== PinGlass Diagnostic Report ===\n');

  try {
    // 1. Referrals table (NOTE: referral_code column does NOT exist!)
    console.log('--- REFERRALS (last 10) ---');
    const referrals = await sql`
      SELECT r.id, r.referrer_id, r.referred_id, r.created_at
      FROM referrals r
      ORDER BY r.created_at DESC LIMIT 10
    `;
    console.log(JSON.stringify(referrals, null, 2));

    // 2. Referral balances
    console.log('\n--- REFERRAL_BALANCES ---');
    const balances = await sql`
      SELECT rb.*, u.telegram_user_id
      FROM referral_balances rb
      JOIN users u ON rb.user_id = u.id
      ORDER BY rb.updated_at DESC
    `;
    console.log(JSON.stringify(balances, null, 2));

    // 3. Users with pending_referral_code
    console.log('\n--- USERS with pending_referral_code ---');
    const pendingUsers = await sql`
      SELECT id, telegram_user_id, pending_referral_code, onboarding_completed_at
      FROM users
      WHERE pending_referral_code IS NOT NULL
      ORDER BY created_at DESC
    `;
    console.log(JSON.stringify(pendingUsers, null, 2));

    // 4. Recent payments
    console.log('\n--- PAYMENTS (last 10) ---');
    const payments = await sql`
      SELECT id, user_id, tbank_payment_id, amount, status, created_at
      FROM payments
      ORDER BY created_at DESC LIMIT 10
    `;
    console.log(JSON.stringify(payments, null, 2));

    // 5. Generation jobs with payment_id
    console.log('\n--- GENERATION_JOBS (last 10) ---');
    const jobs = await sql`
      SELECT gj.id, gj.avatar_id, gj.status, gj.completed_photos, gj.total_photos,
             gj.payment_id, gj.created_at, gj.updated_at
      FROM generation_jobs gj
      ORDER BY gj.created_at DESC LIMIT 10
    `;
    console.log(JSON.stringify(jobs, null, 2));

    // 6. Referral earnings
    console.log('\n--- REFERRAL_EARNINGS (last 10) ---');
    const earnings = await sql`
      SELECT re.*, u.telegram_user_id as referrer_tg
      FROM referral_earnings re
      JOIN users u ON re.referrer_id = u.id
      ORDER BY re.created_at DESC LIMIT 10
    `;
    console.log(JSON.stringify(earnings, null, 2));

    // 7. Referral codes table (potential referrers)
    console.log('\n--- REFERRAL_CODES (active codes) ---');
    const referralCodes = await sql`
      SELECT rc.id, rc.user_id, rc.code, rc.is_active, rc.created_at, u.telegram_user_id
      FROM referral_codes rc
      JOIN users u ON rc.user_id = u.id
      ORDER BY rc.created_at DESC LIMIT 10
    `;
    console.log(JSON.stringify(referralCodes, null, 2));

    // 8. Check onboarding completion
    console.log('\n--- USERS onboarding status ---');
    const onboarding = await sql`
      SELECT id, telegram_user_id, onboarding_completed_at, pending_referral_code
      FROM users
      ORDER BY id DESC LIMIT 10
    `;
    console.log(JSON.stringify(onboarding, null, 2));

  } catch (e) {
    console.error('Error:', e.message);
    console.error('Full error:', e);
  }
}

diagnose();
