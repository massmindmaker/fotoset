-- Migration 017: Fix Referral System
-- Date: 2025-12-23
-- Description: Store referral code in DB instead of localStorage

-- 1. Add pending_referral_code column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_referral_code VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_users_pending_referral ON users(pending_referral_code);
COMMENT ON COLUMN users.pending_referral_code IS 'Referral code from Telegram start_param, saved on first login. Applied on first payment.';

-- 2. Fix UNIQUE constraint on referrals table
-- A user can only have ONE referrer (referred_id must be unique)
-- First check if the old constraint exists and drop it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referrals_referrer_id_referred_id_key'
  ) THEN
    ALTER TABLE referrals DROP CONSTRAINT referrals_referrer_id_referred_id_key;
  END IF;
END $$;

-- Add correct unique constraint on referred_id only (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referrals_referred_id_unique'
  ) THEN
    ALTER TABLE referrals ADD CONSTRAINT referrals_referred_id_unique UNIQUE(referred_id);
  END IF;
END $$;

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id);

-- 4. Verify changes
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'pending_referral_code';
