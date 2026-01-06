-- Migration 032: Multi-currency Referral System
-- Adds support for RUB, Stars, and TON referral earnings/balances
-- Stars are handled by Telegram Affiliate Program (not stored here)
-- TON earnings stored separately from RUB

-- 1. Add multi-currency columns to referral_balances
ALTER TABLE referral_balances
  ADD COLUMN IF NOT EXISTS balance_rub DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_ton DECIMAL(20,9) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earned_rub DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earned_ton DECIMAL(20,9) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withdrawn_rub DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withdrawn_ton DECIMAL(20,9) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ton_wallet_address VARCHAR(48);

-- 2. Migrate existing RUB data
-- balance -> balance_rub, total_earned -> earned_rub, total_withdrawn -> withdrawn_rub
UPDATE referral_balances
SET
  balance_rub = COALESCE(balance, 0),
  earned_rub = COALESCE(total_earned, 0),
  withdrawn_rub = COALESCE(total_withdrawn, 0)
WHERE balance_rub = 0 AND earned_rub = 0;

-- 3. Add currency tracking to referral_earnings
ALTER TABLE referral_earnings
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'RUB',
  ADD COLUMN IF NOT EXISTS native_amount DECIMAL(20,9);

-- Update existing earnings to be RUB
UPDATE referral_earnings
SET currency = 'RUB', native_amount = amount
WHERE currency IS NULL OR currency = '';

-- 4. Add TON support to referral_withdrawals
ALTER TABLE referral_withdrawals
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'RUB',
  ADD COLUMN IF NOT EXISTS ton_wallet_address VARCHAR(48),
  ADD COLUMN IF NOT EXISTS ton_tx_hash CHAR(64);

-- Update existing withdrawals to be RUB
UPDATE referral_withdrawals SET currency = 'RUB' WHERE currency IS NULL;

-- 5. Create table for Telegram MTProto sessions (admin auth)
CREATE TABLE IF NOT EXISTS telegram_mtproto_sessions (
  id SERIAL PRIMARY KEY,
  session_name VARCHAR(100) UNIQUE NOT NULL,
  session_string TEXT NOT NULL,
  phone_number VARCHAR(20),
  user_id BIGINT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Create table for Telegram Affiliate Program settings
CREATE TABLE IF NOT EXISTS telegram_affiliate_settings (
  id SERIAL PRIMARY KEY,
  bot_username VARCHAR(100) NOT NULL,
  commission_permille INTEGER DEFAULT 100, -- 100 = 10%, 500 = 50%
  duration_months INTEGER DEFAULT 0, -- 0 = indefinite
  is_active BOOLEAN DEFAULT FALSE,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. Create indexes
CREATE INDEX IF NOT EXISTS idx_referral_balances_ton ON referral_balances(balance_ton) WHERE balance_ton > 0;
CREATE INDEX IF NOT EXISTS idx_referral_earnings_currency ON referral_earnings(currency);
CREATE INDEX IF NOT EXISTS idx_referral_withdrawals_currency ON referral_withdrawals(currency);

-- 8. Comments
COMMENT ON COLUMN referral_balances.balance_rub IS 'Current RUB balance available for withdrawal';
COMMENT ON COLUMN referral_balances.balance_ton IS 'Current TON balance available for withdrawal';
COMMENT ON COLUMN referral_balances.earned_rub IS 'Total RUB earned from referrals';
COMMENT ON COLUMN referral_balances.earned_ton IS 'Total TON earned from referrals';
COMMENT ON COLUMN referral_balances.ton_wallet_address IS 'Partner TON wallet for withdrawals';
COMMENT ON COLUMN referral_earnings.currency IS 'Currency: RUB, TON (Stars handled by Telegram)';
COMMENT ON COLUMN referral_earnings.native_amount IS 'Amount in native currency (TON/RUB)';
COMMENT ON TABLE telegram_mtproto_sessions IS 'Stores MTProto sessions for admin Telegram API access';
COMMENT ON TABLE telegram_affiliate_settings IS 'Telegram Affiliate Program configuration';
