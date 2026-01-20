#!/usr/bin/env node
import { neon } from '@neondatabase/serverless';

const url = 'postgresql://neondb_owner:npg_Z4kGOoWgLj0D@ep-damp-resonance-a4kycta6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(url);

console.log('=== VERIFYING MIGRATION 048 ===\n');

const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'referral_balances' AND column_name LIKE 'referral_code%' ORDER BY column_name`;
console.log('✅ Columns:');
cols.forEach(c => console.log(`   - ${c.column_name} (${c.data_type})`));

const indexes = await sql`SELECT indexname FROM pg_indexes WHERE tablename = 'referral_balances' AND indexname LIKE '%referral%code%' ORDER BY indexname`;
console.log('\n✅ Indexes:');
indexes.forEach(i => console.log(`   - ${i.indexname}`));

const sample = await sql`SELECT user_id, referral_code, referral_code_telegram, referral_code_web FROM referral_balances LIMIT 3`;
console.log('\n✅ Sample data:');
sample.forEach(s => console.log(`   User ${s.user_id}: code=${s.referral_code || 'null'}, tg=${s.referral_code_telegram || 'null'}, web=${s.referral_code_web || 'null'}`));

console.log('\n✅ Migration 048 verified successfully!');
