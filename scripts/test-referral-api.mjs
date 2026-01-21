#!/usr/bin/env node
import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_Z4kGOoWgLj0D@ep-damp-resonance-a4kycta6.us-east-1.aws.neon.tech/neondb?sslmode=require');

// Find a real user
const users = await sql`SELECT telegram_user_id FROM users WHERE telegram_user_id IS NOT NULL LIMIT 1`;
if (users.length === 0) {
  console.log('No users found');
  process.exit(0);
}

const tgUserId = users[0].telegram_user_id;
console.log('Testing with telegram_user_id:', tgUserId);

const response = await fetch('https://pinglass.ru/api/referral/code?telegram_user_id=' + tgUserId);
const data = await response.json();

console.log('\nFull API Response:');
console.log(JSON.stringify(data, null, 2));

console.log('\n✅ All expected fields present:', !!(
  data.referralCodeTelegram &&
  data.referralCodeWeb &&
  data.telegramLink &&
  data.webLink &&
  data.code &&
  data.isActive !== undefined
));
