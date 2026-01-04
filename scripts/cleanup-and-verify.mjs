#!/usr/bin/env node

/**
 * Cleanup stuck jobs and verify migrations
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import fs from 'fs';

async function main() {
  let dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    try {
      const envContent = fs.readFileSync('.env.local', 'utf8');
      const match = envContent.match(/DATABASE_URL=["']?([^"'\n]+)/);
      if (match) dbUrl = match[1];
    } catch (e) {
      console.error('Cannot read DATABASE_URL');
      process.exit(1);
    }
  }

  const sql = neon(dbUrl);

  console.log('='.repeat(60));
  console.log('Cleanup and Verification Script');
  console.log('='.repeat(60));

  // 1. Fix stuck Job #38
  console.log('\n1. Fixing stuck Job #38...');
  const job38 = await sql`
    UPDATE generation_jobs
    SET status = 'failed',
        error_message = 'Stuck job cleanup - 2026-01-03',
        updated_at = NOW()
    WHERE id = 38 AND status = 'pending'
    RETURNING id, status
  `;
  console.log('   Result:', job38.length > 0 ? '✓ Fixed' : '⚠ Already not pending');

  // 2. Check Payment #45
  console.log('\n2. Checking Payment #45...');
  const payment45 = await sql`
    SELECT p.id, p.status, p.generation_consumed, p.amount, p.tier_id,
           u.telegram_user_id, p.created_at
    FROM payments p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = 45
  `;
  if (payment45.length > 0) {
    const p = payment45[0];
    console.log('   Payment ID:', p.id);
    console.log('   Status:', p.status);
    console.log('   Consumed:', p.generation_consumed);
    console.log('   Amount:', p.amount, 'RUB');
    console.log('   Tier:', p.tier_id);
    console.log('   Telegram User:', p.telegram_user_id);
    console.log('   Created:', p.created_at);

    if (p.status === 'succeeded' && !p.generation_consumed) {
      console.log('\n   ⚠ This payment is available for generation!');
      console.log('   User can still use it by starting generation.');
    }
  } else {
    console.log('   Payment #45 not found');
  }

  // 3. Verify migrations
  console.log('\n3. Verifying migrations...');

  const constraint = await sql`
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_name = 'generation_jobs' AND constraint_name = 'generation_jobs_payment_id_unique'
  `;
  console.log('   Migration 030 (unique constraint):', constraint.length > 0 ? '✓ EXISTS' : '✗ MISSING');

  const table031 = await sql`SELECT COUNT(*) as count FROM qstash_processed_messages`;
  console.log('   Migration 031 (idempotency table): ✓ EXISTS (' + table031[0].count + ' records)');

  const dlq = await sql`SELECT COUNT(*) as count FROM generation_dead_letter_queue`;
  console.log('   DLQ Table: ✓ EXISTS (' + dlq[0].count + ' records)');

  // 4. Current job status summary
  console.log('\n4. Current generation jobs status:');
  const jobStats = await sql`
    SELECT status, COUNT(*) as count
    FROM generation_jobs
    GROUP BY status
    ORDER BY count DESC
  `;
  jobStats.forEach(s => {
    console.log(`   ${s.status}: ${s.count}`);
  });

  // 5. Recent successful generations
  console.log('\n5. Last 3 successful generations:');
  const recentSuccess = await sql`
    SELECT id, avatar_id, completed_photos, total_photos,
           created_at, updated_at
    FROM generation_jobs
    WHERE status = 'completed'
    ORDER BY updated_at DESC
    LIMIT 3
  `;
  recentSuccess.forEach(j => {
    console.log(`   Job #${j.id}: ${j.completed_photos}/${j.total_photos} photos (${j.updated_at})`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('✅ Cleanup and verification completed!');
}

main().catch(console.error);
