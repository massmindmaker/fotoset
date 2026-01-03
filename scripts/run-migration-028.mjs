#!/usr/bin/env node

/**
 * Migration 028: Exchange Rates & Orphan Payments
 * Creates tables for currency exchange rates and unmatched TON transactions
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

  console.log('Running migration 028: Exchange Rates & Orphan Payments...\n');

  try {
    // Step 1: Create exchange_rates table
    console.log('Creating exchange_rates table...');
    await sql`
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id SERIAL PRIMARY KEY,
        from_currency VARCHAR(10) NOT NULL,
        to_currency VARCHAR(10) NOT NULL,
        rate DECIMAL(18,9) NOT NULL,
        source VARCHAR(50),
        fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        raw_response JSONB
      )
    `;
    console.log('   Done\n');

    // Step 2: Create index for exchange rate lookups
    console.log('Creating exchange rates lookup index...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup
      ON exchange_rates(from_currency, to_currency, fetched_at DESC)
    `;
    console.log('   Done\n');

    // Step 3: Create orphan_payments table for unmatched TON transactions
    console.log('Creating orphan_payments table...');
    await sql`
      CREATE TABLE IF NOT EXISTS orphan_payments (
        id SERIAL PRIMARY KEY,
        tx_hash CHAR(64) UNIQUE,
        amount DECIMAL(20,9),
        wallet_address VARCHAR(48),
        status VARCHAR(20) DEFAULT 'unmatched',
        matched_payment_id INTEGER REFERENCES payments(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log('   Done\n');

    // Step 4: Create index for orphan payments status
    console.log('Creating orphan payments status index...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_orphan_payments_status
      ON orphan_payments(status)
    `;
    console.log('   Done\n');

    // Step 5: Add comments for documentation
    console.log('Adding table comments...');
    await sql`COMMENT ON TABLE exchange_rates IS 'Currency exchange rates history for XTR (Telegram Stars) and TON to RUB conversion'`;
    await sql`COMMENT ON COLUMN exchange_rates.from_currency IS 'Source currency: XTR (Stars), TON'`;
    await sql`COMMENT ON COLUMN exchange_rates.to_currency IS 'Target currency: RUB'`;
    await sql`COMMENT ON COLUMN exchange_rates.source IS 'Rate source: telegram_api, coingecko'`;
    await sql`COMMENT ON COLUMN exchange_rates.expires_at IS 'Rate validity expiration (15 min for rate locking)'`;

    await sql`COMMENT ON TABLE orphan_payments IS 'TON transactions received but not matched to pending payment'`;
    await sql`COMMENT ON COLUMN orphan_payments.status IS 'unmatched, matched, refunded'`;
    console.log('   Done\n');

    // Verify migration
    console.log('Verifying migration...');

    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('exchange_rates', 'orphan_payments')
    `;

    console.log('   New tables:', tables.map(t => t.table_name).join(', '));

    const indexes = await sql`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE tablename IN ('exchange_rates', 'orphan_payments')
        AND schemaname = 'public'
    `;

    console.log('   Indexes:');
    indexes.forEach(i => console.log(`      ${i.tablename}: ${i.indexname}`));

    console.log('\n Migration 028 completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
