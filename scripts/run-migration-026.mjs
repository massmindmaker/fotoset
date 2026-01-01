#!/usr/bin/env node

/**
 * Migration 026: Payment-Generation Binding
 * Ensures each generation is tied to a specific payment
 */

import { neon } from '@neondatabase/serverless';

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  console.log('🚀 Running migration 026: Payment-Generation Binding...\n');

  try {
    // Step 1: Add columns
    console.log('📝 Adding generation_consumed column...');
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS generation_consumed BOOLEAN DEFAULT FALSE`;
    console.log('   ✓ Done\n');

    console.log('📝 Adding consumed_at column...');
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMP WITH TIME ZONE`;
    console.log('   ✓ Done\n');

    console.log('📝 Adding consumed_avatar_id column...');
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS consumed_avatar_id INTEGER`;
    console.log('   ✓ Done\n');

    // Step 2: Create index
    console.log('📝 Creating index for available payments...');
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_available ON payments(user_id, status, generation_consumed) WHERE status = 'succeeded' AND generation_consumed = FALSE`;
    console.log('   ✓ Done\n');

    // Step 3: Mark existing payments as consumed if they have linked generation jobs
    console.log('📝 Marking payments with linked generation jobs as consumed...');
    const linkedResult = await sql`
      UPDATE payments p
      SET generation_consumed = TRUE,
          consumed_at = gj.created_at,
          consumed_avatar_id = gj.avatar_id
      FROM generation_jobs gj
      WHERE gj.payment_id = p.id
        AND COALESCE(p.generation_consumed, FALSE) = FALSE
    `;
    console.log(`   ✓ Updated based on payment_id linkage\n`);

    // Step 4: Mark historical payments that likely had generations
    console.log('📝 Marking historical payments with generations within 1 day...');
    const historicalResult = await sql`
      UPDATE payments p
      SET generation_consumed = TRUE,
          consumed_at = (
            SELECT MIN(gj.created_at)
            FROM generation_jobs gj
            JOIN avatars a ON a.id = gj.avatar_id
            WHERE a.user_id = p.user_id
              AND gj.created_at >= p.created_at
              AND gj.created_at <= p.created_at + interval '1 day'
          )
      WHERE p.status = 'succeeded'
        AND COALESCE(p.generation_consumed, FALSE) = FALSE
        AND EXISTS (
          SELECT 1
          FROM generation_jobs gj
          JOIN avatars a ON a.id = gj.avatar_id
          WHERE a.user_id = p.user_id
            AND gj.created_at >= p.created_at
            AND gj.created_at <= p.created_at + interval '1 day'
        )
    `;
    console.log(`   ✓ Updated historical payments\n`);

    // Verify migration
    console.log('🔍 Verifying migration...');

    const columns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'payments'
        AND column_name IN ('generation_consumed', 'consumed_at', 'consumed_avatar_id')
    `;

    console.log('   Found columns:', columns.map(c => c.column_name).join(', '));

    // Count consumed payments
    const stats = await sql`
      SELECT
        COUNT(*) FILTER (WHERE COALESCE(generation_consumed, FALSE) = TRUE) as consumed,
        COUNT(*) FILTER (WHERE COALESCE(generation_consumed, FALSE) = FALSE AND status = 'succeeded') as available,
        COUNT(*) as total
      FROM payments
    `;

    console.log(`\n📊 Payment stats after migration:`);
    console.log(`   Total payments: ${stats[0].total}`);
    console.log(`   Consumed (used for generation): ${stats[0].consumed}`);
    console.log(`   Available (can be used): ${stats[0].available}`);

    console.log('\n✅ Migration 026 completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
