import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function clearDatabase() {
  console.log('🗑️  Очистка базы данных PinGlass...\n');

  // Clear all tables in one TRUNCATE CASCADE
  try {
    await sql`
      TRUNCATE TABLE
        webhook_logs,
        referral_earnings,
        referral_balances,
        referrals,
        referral_codes,
        generation_jobs,
        generated_photos,
        reference_photos,
        payments,
        avatars,
        users
      RESTART IDENTITY CASCADE
    `;
    console.log('✅ Все таблицы очищены');
  } catch (err) {
    console.log('⚠️  Ошибка TRUNCATE:', err.message);

    // Fallback: delete one by one
    console.log('\n🔄 Пробуем DELETE...');

    try { await sql`DELETE FROM webhook_logs`; console.log('✅ webhook_logs'); } catch (e) { console.log('⚠️ webhook_logs:', e.message.slice(0,40)); }
    try { await sql`DELETE FROM referral_earnings`; console.log('✅ referral_earnings'); } catch (e) { console.log('⚠️ referral_earnings:', e.message.slice(0,40)); }
    try { await sql`DELETE FROM referral_balances`; console.log('✅ referral_balances'); } catch (e) { console.log('⚠️ referral_balances:', e.message.slice(0,40)); }
    try { await sql`DELETE FROM referrals`; console.log('✅ referrals'); } catch (e) { console.log('⚠️ referrals:', e.message.slice(0,40)); }
    try { await sql`DELETE FROM referral_codes`; console.log('✅ referral_codes'); } catch (e) { console.log('⚠️ referral_codes:', e.message.slice(0,40)); }
    try { await sql`DELETE FROM generation_jobs`; console.log('✅ generation_jobs'); } catch (e) { console.log('⚠️ generation_jobs:', e.message.slice(0,40)); }
    try { await sql`DELETE FROM generated_photos`; console.log('✅ generated_photos'); } catch (e) { console.log('⚠️ generated_photos:', e.message.slice(0,40)); }
    try { await sql`DELETE FROM reference_photos`; console.log('✅ reference_photos'); } catch (e) { console.log('⚠️ reference_photos:', e.message.slice(0,40)); }
    try { await sql`DELETE FROM payments`; console.log('✅ payments'); } catch (e) { console.log('⚠️ payments:', e.message.slice(0,40)); }
    try { await sql`DELETE FROM avatars`; console.log('✅ avatars'); } catch (e) { console.log('⚠️ avatars:', e.message.slice(0,40)); }
    try { await sql`DELETE FROM users`; console.log('✅ users'); } catch (e) { console.log('⚠️ users:', e.message.slice(0,40)); }
  }

  // Verify counts
  console.log('\n📊 Проверка:');
  const counts = await sql`
    SELECT
      (SELECT COUNT(*) FROM users) as users,
      (SELECT COUNT(*) FROM avatars) as avatars,
      (SELECT COUNT(*) FROM payments) as payments,
      (SELECT COUNT(*) FROM referral_codes) as referral_codes,
      (SELECT COUNT(*) FROM referrals) as referrals
  `;
  console.log('   users:', counts[0].users);
  console.log('   avatars:', counts[0].avatars);
  console.log('   payments:', counts[0].payments);
  console.log('   referral_codes:', counts[0].referral_codes);
  console.log('   referrals:', counts[0].referrals);

  console.log('\n✨ База данных полностью очищена!');
}

clearDatabase().catch(console.error);
