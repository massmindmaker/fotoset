#!/usr/bin/env node

/**
 * Migration 030: Payment Consumption Protection
 * - Adds unique constraint on payment_id in generation_jobs (prevents double generation)
 * - Adds index for faster payment lookup
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  console.log('Running migration 030: Payment Consumption Protection...\n');

  try {
    // Step 1: Add unique constraint on payment_id (prevents double generation on one payment)
    console.log('1. Adding unique constraint on payment_id in generation_jobs...');
    try {
      await sql`
        ALTER TABLE generation_jobs
        ADD CONSTRAINT generation_jobs_payment_id_unique UNIQUE (payment_id)
      `;
      console.log('   ✓ Constraint added\n');
    } catch (error) {
      if (error.message?.includes('already exists')) {
        console.log('   ⚠ Constraint already exists, skipping\n');
      } else {
        throw error;
      }
    }

    // Step 2: Add index for faster payment lookup (unconsumed payments only)
    console.log('2. Adding index for faster unconsumed payment lookup...');
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_payments_available_for_generation
        ON payments (user_id, created_at DESC)
        WHERE status = 'succeeded' AND generation_consumed = FALSE
      `;
      console.log('   ✓ Index created\n');
    } catch (error) {
      if (error.message?.includes('already exists')) {
        console.log('   ⚠ Index already exists, skipping\n');
      } else {
        throw error;
      }
    }

    // Step 3: Add comments
    console.log('3. Adding column comments...');
    await sql`COMMENT ON CONSTRAINT generation_jobs_payment_id_unique ON generation_jobs IS 'Prevents creating multiple generation jobs for one payment (race condition protection)'`;
    console.log('   ✓ Comment added\n');

    // Verify migration
    console.log('4. Verifying migration...');

    const constraints = await sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'generation_jobs'
        AND constraint_name = 'generation_jobs_payment_id_unique'
    `;

    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'payments'
        AND indexname = 'idx_payments_available_for_generation'
    `;

    console.log('   Constraints:', constraints.map(c => c.constraint_name).join(', ') || 'none');
    console.log('   Indexes:', indexes.map(i => i.indexname).join(', ') || 'none');

    console.log('\n✅ Migration 030 completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
