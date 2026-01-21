#!/usr/bin/env node
import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_Z4kGOoWgLj0D@ep-damp-resonance-a4kycta6.us-east-1.aws.neon.tech/neondb?sslmode=require');

// Get first user
const user = await sql`SELECT id, telegram_user_id FROM users WHERE telegram_user_id = 594 LIMIT 1`;
if (!user[0]) {
  console.log('User 594 not found');
  process.exit(1);
}

console.log('User:', user[0]);

// Check referral balance
const balance = await sql`
  SELECT * FROM referral_balances WHERE user_id = ${user[0].id}
`;

console.log('Referral balance:', balance[0] || 'NOT FOUND');

// If not found, API should create one - test it
console.log('\nTesting API...');
const response = await fetch(`https://pinglass.ru/api/referral/code?telegram_user_id=594`);
const data = await response.json();
console.log('API response:', data);

// Check again
const balanceAfter = await sql`
  SELECT * FROM referral_balances WHERE user_id = ${user[0].id}
`;
console.log('\nReferral balance after API call:', balanceAfter[0] || 'STILL NOT FOUND');
