#!/usr/bin/env node
import { neon } from '@neondatabase/serverless';

const DB_URL = 'postgresql://neondb_owner:npg_Z4kGOoWgLj0D@ep-damp-resonance-a4kycta6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const API_BASE = 'https://pinglass.ru';
const sql = neon(DB_URL);

console.log('=== TESTING PRODUCTION APIs ===\n');

// 1. Get a real production user
console.log('1. Finding production users...');
const users = await sql`
  SELECT id, telegram_user_id, telegram_username
  FROM users
  WHERE telegram_user_id IS NOT NULL
  LIMIT 3
`;

if (users.length === 0) {
  console.error('❌ No users found in production!');
  process.exit(1);
}

console.log('✅ Found users:', users.map(u => `@${u.telegram_username || u.id}`).join(', '));
const testUser = users[0];

// 2. Test dual referral code API
console.log('\n2. Testing /api/referral/code...');
const codeResponse = await fetch(`${API_BASE}/api/referral/code?telegram_user_id=${testUser.telegram_user_id}`);
const codeData = await codeResponse.json();

if (codeResponse.ok) {
  console.log('✅ Dual referral codes work:', {
    telegramCode: codeData.referralCodeTelegram,
    webCode: codeData.referralCodeWeb,
    hasTelegramLink: !!codeData.telegramLink,
    hasWebLink: !!codeData.webLink
  });
} else {
  console.error('❌ Referral code API failed:', codeData);
}

// 3. Check withdrawal webhook protection
console.log('\n3. Checking jump_webhook_logs table...');
const webhookLogs = await sql`
  SELECT COUNT(*) as count FROM jump_webhook_logs
`;
console.log('✅ jump_webhook_logs table exists with', webhookLogs[0].count, 'rows');

// 4. Check pack prompts limit
console.log('\n4. Checking pack_prompts...');
const packPrompts = await sql`
  SELECT pack_id, COUNT(*) as prompt_count
  FROM pack_prompts
  WHERE is_active = TRUE
  GROUP BY pack_id
  ORDER BY prompt_count DESC
  LIMIT 3
`;

if (packPrompts.length > 0) {
  console.log('✅ Pack prompts exist:');
  packPrompts.forEach(p => console.log(`   Pack #${p.pack_id}: ${p.prompt_count} prompts`));

  const exceededLimit = packPrompts.filter(p => parseInt(p.prompt_count) > 23);
  if (exceededLimit.length > 0) {
    console.error('⚠️  WARNING: Some packs exceed 23 prompt limit!');
  }
} else {
  console.log('ℹ️  No pack prompts found yet (new feature)');
}

// 5. Test payment status endpoint
console.log('\n5. Testing /api/payment/status...');
const payments = await sql`
  SELECT payment_id, user_id, status
  FROM payments
  WHERE status = 'succeeded'
  LIMIT 1
`;

if (payments.length > 0) {
  const testPayment = payments[0];
  const statusResponse = await fetch(`${API_BASE}/api/payment/status?user_id=${testPayment.user_id}&payment_id=${testPayment.payment_id}`);
  const statusData = await statusResponse.json();

  if (statusResponse.ok) {
    console.log('✅ Payment status API works:', statusData);
  } else {
    console.error('❌ Payment status API failed:', statusData);
  }
} else {
  console.log('ℹ️  No successful payments found to test');
}

console.log('\n=== PRODUCTION API TEST COMPLETE ===');
