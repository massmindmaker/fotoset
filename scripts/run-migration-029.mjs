#!/usr/bin/env node

/**
 * Migration 029: Referral Earnings Currency Tracking
 * Adds source currency and exchange rate tracking for multi-currency referrals
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

  console.log('Running migration 029: Referral Earnings Currency Tracking...\n');

  try {
    // Step 1: Add source_currency column
    console.log('Adding source_currency column to referral_earnings...');
    await sql`
      ALTER TABLE referral_earnings
      ADD COLUMN IF NOT EXISTS source_currency VARCHAR(10) DEFAULT 'RUB'
    `;
    console.log('   Done\n');

    // Step 2: Add exchange_rate_used column
    console.log('Adding exchange_rate_used column to referral_earnings...');
    await sql`
      ALTER TABLE referral_earnings
      ADD COLUMN IF NOT EXISTS exchange_rate_used DECIMAL(18,9)
    `;
    console.log('   Done\n');

    // Step 3: Add comments
    console.log('Adding column comments...');
    await sql`COMMENT ON COLUMN referral_earnings.source_currency IS 'Original payment currency: RUB, XTR (Stars), TON'`;
    await sql`COMMENT ON COLUMN referral_earnings.exchange_rate_used IS 'Exchange rate used to convert to RUB for earnings calculation'`;
    console.log('   Done\n');

    // Verify migration
    console.log('Verifying migration...');

    const columns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'referral_earnings'
        AND column_name IN ('source_currency', 'exchange_rate_used')
    `;

    console.log('   New columns:');
    columns.forEach(c => console.log(`      ${c.column_name}: ${c.data_type} (default: ${c.column_default || 'NULL'})`));

    console.log('\n Migration 029 completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
