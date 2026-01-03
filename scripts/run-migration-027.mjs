#!/usr/bin/env node

/**
 * Migration 027: Multi-Provider Payment Support
 * Adds columns for Telegram Stars and TON crypto payments
 * Includes UNIQUE indexes for double-spending prevention
 */

import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables from .env.local
config({ path: '.env.local' });

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  console.log('Running migration 027: Multi-Provider Payment Support...\n');

  try {
    // Step 1: Provider identification
    console.log('Adding provider column...');
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'tbank'`;
    console.log('   Done\n');

    console.log('Adding provider_payment_id column...');
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(255)`;
    console.log('   Done\n');

    // Step 2: Telegram Stars columns
    console.log('Adding Telegram Stars columns...');
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS telegram_charge_id VARCHAR(255)`;
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS stars_amount INTEGER`;
    console.log('   Done\n');

    // Step 3: TON columns (CHAR(64) for 256-bit hash)
    console.log('Adding TON columns...');
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS ton_tx_hash CHAR(64)`;
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS ton_amount DECIMAL(20,9)`;
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS ton_sender_address VARCHAR(48)`;
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS ton_confirmations INTEGER DEFAULT 0`;
    console.log('   Done\n');

    // Step 4: Currency tracking with rate locking
    console.log('Adding currency tracking columns...');
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS original_currency VARCHAR(10) DEFAULT 'RUB'`;
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS original_amount DECIMAL(18,9)`;
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(18,9)`;
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS rate_locked_at TIMESTAMP WITH TIME ZONE`;
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS rate_expires_at TIMESTAMP WITH TIME ZONE`;
    console.log('   Done\n');

    // Step 5: CRITICAL - UNIQUE indexes for double-spending prevention
    console.log('Creating UNIQUE index for telegram_charge_id (double-spending prevention)...');
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_telegram_charge ON payments(telegram_charge_id) WHERE telegram_charge_id IS NOT NULL`;
    console.log('   Done\n');

    console.log('Creating UNIQUE index for ton_tx_hash (double-spending prevention)...');
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_ton_tx ON payments(ton_tx_hash) WHERE ton_tx_hash IS NOT NULL`;
    console.log('   Done\n');

    // Step 6: Regular indexes
    console.log('Creating provider index...');
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider)`;
    console.log('   Done\n');

    console.log('Creating TON pending payments index...');
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_ton_pending ON payments(status, provider) WHERE provider = 'ton' AND status = 'pending'`;
    console.log('   Done\n');

    // Step 7: Backfill existing T-Bank payments
    console.log('Backfilling existing T-Bank payments...');
    const result = await sql`
      UPDATE payments
      SET provider = 'tbank',
          provider_payment_id = tbank_payment_id
      WHERE provider IS NULL OR provider = ''
    `;
    console.log(`   Updated ${result.count || 0} rows\n`);

    // Verify migration
    console.log('Verifying migration...');

    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'payments'
        AND column_name IN (
          'provider', 'provider_payment_id',
          'telegram_charge_id', 'stars_amount',
          'ton_tx_hash', 'ton_amount', 'ton_sender_address', 'ton_confirmations',
          'original_currency', 'original_amount', 'exchange_rate',
          'rate_locked_at', 'rate_expires_at'
        )
      ORDER BY column_name
    `;

    console.log('   New columns:', columns.map(c => c.column_name).join(', '));

    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'payments'
        AND indexname IN ('idx_payments_telegram_charge', 'idx_payments_ton_tx', 'idx_payments_provider', 'idx_payments_ton_pending')
    `;

    console.log('   New indexes:', indexes.map(i => i.indexname).join(', '));

    // Provider stats
    const stats = await sql`
      SELECT provider, COUNT(*) as count
      FROM payments
      GROUP BY provider
    `;

    console.log('\n Payment stats by provider:');
    stats.forEach(s => console.log(`   ${s.provider}: ${s.count} payments`));

    console.log('\n Migration 027 completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
