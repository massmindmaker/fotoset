#!/usr/bin/env node

/**
 * Migration 032: Multi-currency Referral System
 * - Adds RUB/TON columns to referral_balances
 * - Adds currency tracking to referral_earnings
 * - Adds TON withdrawal support
 * - Creates telegram_mtproto_sessions table
 * - Creates telegram_affiliate_settings table
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;

  if (!databaseUrl) {
    console.error('DATABASE_URL or DATABASE_URL_UNPOOLED environment variable is not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  console.log('Running migration 032: Multi-currency Referral System...\n');

  try {
    // Step 1: Add multi-currency columns to referral_balances
    console.log('1. Adding multi-currency columns to referral_balances...');
    await sql`
      ALTER TABLE referral_balances
        ADD COLUMN IF NOT EXISTS balance_rub DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS balance_ton DECIMAL(20,9) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS earned_rub DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS earned_ton DECIMAL(20,9) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS withdrawn_rub DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS withdrawn_ton DECIMAL(20,9) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS ton_wallet_address VARCHAR(48)
    `;
    console.log('   ✓ Columns added\n');

    // Step 2: Migrate existing RUB data
    console.log('2. Migrating existing RUB data...');
    const migrated = await sql`
      UPDATE referral_balances
      SET
        balance_rub = COALESCE(balance, 0),
        earned_rub = COALESCE(total_earned, 0),
        withdrawn_rub = COALESCE(total_withdrawn, 0)
      WHERE balance_rub = 0 AND earned_rub = 0
      RETURNING id
    `;
    console.log(`   ✓ Migrated ${migrated.length} records\n`);

    // Step 3: Add currency tracking to referral_earnings
    console.log('3. Adding currency tracking to referral_earnings...');
    await sql`
      ALTER TABLE referral_earnings
        ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'RUB',
        ADD COLUMN IF NOT EXISTS native_amount DECIMAL(20,9)
    `;

    const updated = await sql`
      UPDATE referral_earnings
      SET currency = 'RUB', native_amount = amount
      WHERE currency IS NULL OR currency = ''
      RETURNING id
    `;
    console.log(`   ✓ Updated ${updated.length} earning records\n`);

    // Step 4: Add TON support to referral_withdrawals
    console.log('4. Adding TON support to referral_withdrawals...');
    await sql`
      ALTER TABLE referral_withdrawals
        ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'RUB',
        ADD COLUMN IF NOT EXISTS ton_wallet_address VARCHAR(48),
        ADD COLUMN IF NOT EXISTS ton_tx_hash CHAR(64)
    `;

    await sql`UPDATE referral_withdrawals SET currency = 'RUB' WHERE currency IS NULL`;
    console.log('   ✓ Columns added\n');

    // Step 5: Create telegram_mtproto_sessions table
    console.log('5. Creating telegram_mtproto_sessions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS telegram_mtproto_sessions (
        id SERIAL PRIMARY KEY,
        session_name VARCHAR(100) UNIQUE NOT NULL,
        session_string TEXT NOT NULL,
        phone_number VARCHAR(20),
        user_id BIGINT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('   ✓ Table created\n');

    // Step 6: Create telegram_affiliate_settings table
    console.log('6. Creating telegram_affiliate_settings table...');
    await sql`
      CREATE TABLE IF NOT EXISTS telegram_affiliate_settings (
        id SERIAL PRIMARY KEY,
        bot_username VARCHAR(100) NOT NULL,
        commission_permille INTEGER DEFAULT 100,
        duration_months INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT FALSE,
        last_synced_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('   ✓ Table created\n');

    // Step 7: Create indexes
    console.log('7. Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_referral_balances_ton ON referral_balances(balance_ton) WHERE balance_ton > 0`;
    await sql`CREATE INDEX IF NOT EXISTS idx_referral_earnings_currency ON referral_earnings(currency)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_referral_withdrawals_currency ON referral_withdrawals(currency)`;
    console.log('   ✓ Indexes created\n');

    // Verify migration
    console.log('8. Verifying migration...');

    // Check referral_balances columns
    const balanceColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'referral_balances'
        AND column_name IN ('balance_rub', 'balance_ton', 'earned_rub', 'earned_ton', 'ton_wallet_address')
    `;
    console.log('   referral_balances new columns:', balanceColumns.map(c => c.column_name).join(', '));

    // Check new tables
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('telegram_mtproto_sessions', 'telegram_affiliate_settings')
    `;
    console.log('   New tables:', tables.map(t => t.table_name).join(', '));

    // Show current referral balances
    const balances = await sql`
      SELECT COUNT(*) as total,
             SUM(balance_rub) as total_rub,
             SUM(balance_ton) as total_ton
      FROM referral_balances
    `;
    console.log(`   Balances: ${balances[0].total} records, ${balances[0].total_rub || 0} RUB, ${balances[0].total_ton || 0} TON`);

    console.log('\n✅ Migration 032 completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
