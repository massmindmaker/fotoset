#!/usr/bin/env node
import { neon } from '@neondatabase/serverless';

const url = 'postgresql://neondb_owner:npg_Z4kGOoWgLj0D@ep-damp-resonance-a4kycta6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(url);

console.log('=== CHECKING MIGRATIONS STATUS ===\n');

// Migration 045: deferred_referral_earnings
const m045 = await sql`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_earnings' AND column_name = 'generation_job_id')`;
console.log('045 (deferred earnings):', m045[0].exists ? '✅ APPLIED' : '❌ MISSING');

// Migration 046: jump_finance
const m046 = await sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'withdrawals')`;
console.log('046 (Jump.Finance):   ', m046[0].exists ? '✅ APPLIED' : '❌ MISSING');

// Migration 047: dynamic_packs
const m047 = await sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pack_prompts')`;
console.log('047 (pack system):    ', m047[0].exists ? '✅ APPLIED' : '❌ MISSING');

// Migration 048: dual_referral_codes
const m048 = await sql`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_balances' AND column_name = 'referral_code_telegram')`;
console.log('048 (dual referral):  ', m048[0].exists ? '✅ APPLIED' : '❌ MISSING');

console.log('\n=== SUMMARY ===');
const applied = [m045[0].exists, m046[0].exists, m047[0].exists, m048[0].exists].filter(Boolean).length;
console.log(`Applied: ${applied}/4 migrations`);
