import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function diagnose() {
  console.log('='.repeat(60));
  console.log('DATA CONSISTENCY DIAGNOSIS');
  console.log('='.repeat(60));

  // 1. Check referral_balances table structure
  console.log('\n📊 1. REFERRAL_BALANCES TABLE STRUCTURE:');
  const columns = await sql`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'referral_balances'
    ORDER BY ordinal_position
  `;
  console.table(columns);

  // 2. Check actual data in referral_balances
  console.log('\n📊 2. REFERRAL_BALANCES DATA (TOP 10):');
  const balances = await sql`
    SELECT
      rb.user_id,
      u.telegram_user_id,
      rb.balance,
      rb.total_earned,
      rb.total_withdrawn,
      rb.referrals_count,
      rb.commission_rate,
      rb.is_partner
    FROM referral_balances rb
    JOIN users u ON u.id = rb.user_id
    ORDER BY rb.total_earned DESC
    LIMIT 10
  `;
  console.table(balances);

  // 3. Check referral_earnings vs referral_balances
  console.log('\n📊 3. COMPARING EARNINGS SUM vs BALANCES:');
  const comparison = await sql`
    SELECT
      rb.user_id,
      u.telegram_user_id,
      rb.total_earned as balance_total_earned,
      COALESCE(SUM(re.amount), 0)::numeric as earnings_sum,
      rb.balance as current_balance,
      rb.total_withdrawn
    FROM referral_balances rb
    JOIN users u ON u.id = rb.user_id
    LEFT JOIN referral_earnings re ON re.referrer_id = rb.user_id AND re.status = 'confirmed'
    GROUP BY rb.user_id, u.telegram_user_id, rb.total_earned, rb.balance, rb.total_withdrawn
    HAVING rb.total_earned != COALESCE(SUM(re.amount), 0)
    LIMIT 10
  `;
  if (comparison.length === 0) {
    console.log('✅ No mismatches found between referral_earnings and referral_balances');
  } else {
    console.log('❌ MISMATCHES FOUND:');
    console.table(comparison);
  }

  // 4. Check total_spent calculation in users
  console.log('\n📊 4. CHECKING TOTAL_SPENT CALCULATION:');
  const spentCheck = await sql`
    SELECT
      u.id as user_id,
      u.telegram_user_id,
      COALESCE(SUM(CASE WHEN p.status = 'succeeded' THEN p.amount ELSE 0 END), 0)::numeric as calculated_spent,
      COUNT(CASE WHEN p.status = 'succeeded' THEN 1 END)::int as successful_payments,
      COUNT(p.id)::int as total_payments
    FROM users u
    LEFT JOIN payments p ON p.user_id = u.id
    GROUP BY u.id, u.telegram_user_id
    HAVING COUNT(p.id) > 0
    ORDER BY calculated_spent DESC
    LIMIT 10
  `;
  console.table(spentCheck);

  // 5. Check commission_rate values
  console.log('\n📊 5. COMMISSION_RATE DISTRIBUTION:');
  const commissionStats = await sql`
    SELECT
      commission_rate,
      is_partner,
      COUNT(*) as count,
      SUM(total_earned) as total_earnings
    FROM referral_balances
    GROUP BY commission_rate, is_partner
    ORDER BY commission_rate DESC
  `;
  console.table(commissionStats);

  // 6. Aggregate stats comparison
  console.log('\n📊 6. AGGREGATE STATS:');
  const [stats] = await sql`
    SELECT
      (SELECT COUNT(*) FROM users)::int as total_users,
      (SELECT COUNT(DISTINCT user_id) FROM payments WHERE status = 'succeeded')::int as paying_users,
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'succeeded')::numeric as total_revenue,
      (SELECT COALESCE(SUM(total_earned), 0) FROM referral_balances)::numeric as total_referral_earned,
      (SELECT COALESCE(SUM(balance), 0) FROM referral_balances)::numeric as total_referral_balance,
      (SELECT COALESCE(SUM(amount), 0) FROM referral_earnings WHERE status = 'confirmed')::numeric as confirmed_earnings,
      (SELECT COALESCE(SUM(amount), 0) FROM referral_earnings)::numeric as all_earnings
  `;
  console.log('Total Users:', stats.total_users);
  console.log('Paying Users:', stats.paying_users);
  console.log('Total Revenue:', stats.total_revenue, 'RUB');
  console.log('Total Referral Earned (from balances):', stats.total_referral_earned, 'RUB');
  console.log('Total Referral Balance:', stats.total_referral_balance, 'RUB');
  console.log('Confirmed Earnings (from referral_earnings):', stats.confirmed_earnings, 'RUB');
  console.log('All Earnings (from referral_earnings):', stats.all_earnings, 'RUB');

  // 7. Check referral_earnings statuses
  console.log('\n📊 7. REFERRAL_EARNINGS STATUS DISTRIBUTION:');
  const earningsStatus = await sql`
    SELECT
      status,
      COUNT(*) as count,
      SUM(amount)::numeric as total_amount
    FROM referral_earnings
    GROUP BY status
    ORDER BY count DESC
  `;
  console.table(earningsStatus);

  // 8. Check formula: balance = total_earned - total_withdrawn
  console.log('\n📊 8. BALANCE FORMULA CHECK (balance = total_earned - total_withdrawn):');
  const balanceCheck = await sql`
    SELECT
      user_id,
      balance,
      total_earned,
      total_withdrawn,
      (total_earned - total_withdrawn)::numeric as expected_balance,
      (balance - (total_earned - total_withdrawn))::numeric as difference
    FROM referral_balances
    WHERE balance != (total_earned - total_withdrawn)
    LIMIT 10
  `;
  if (balanceCheck.length === 0) {
    console.log('✅ All balances match formula: balance = total_earned - total_withdrawn');
  } else {
    console.log('❌ BALANCE FORMULA MISMATCHES:');
    console.table(balanceCheck);
  }

  console.log('\n' + '='.repeat(60));
  console.log('DIAGNOSIS COMPLETE');
  console.log('='.repeat(60));
}

diagnose().catch(console.error);
