-- Migration 048: Dual Referral Codes (Telegram + Web)
-- Created: 2026-01-20
-- Purpose: Support separate referral codes for Telegram and Web platforms

-- Step 1: Add legacy referral_code column if not exists (for backward compatibility)
ALTER TABLE referral_balances
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20);

-- Step 2: Add new columns for platform-specific referral codes
ALTER TABLE referral_balances
ADD COLUMN IF NOT EXISTS referral_code_telegram VARCHAR(20),
ADD COLUMN IF NOT EXISTS referral_code_web VARCHAR(20);

-- Step 3: Create unique indexes for all three codes
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_balances_code
ON referral_balances(referral_code)
WHERE referral_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_balances_code_telegram
ON referral_balances(referral_code_telegram)
WHERE referral_code_telegram IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_balances_code_web
ON referral_balances(referral_code_web)
WHERE referral_code_web IS NOT NULL;

-- Step 4: Migrate existing referral_code to both new fields (for backward compatibility)
-- Existing users get the same code for both platforms initially
UPDATE referral_balances
SET
  referral_code_telegram = COALESCE(referral_code_telegram, referral_code),
  referral_code_web = COALESCE(referral_code_web, referral_code)
WHERE referral_code IS NOT NULL;

-- Step 5: Add comments for documentation
COMMENT ON COLUMN referral_balances.referral_code IS 'Legacy referral code (deprecated, kept for backward compatibility)';
COMMENT ON COLUMN referral_balances.referral_code_telegram IS 'Referral code for Telegram Mini App (t.me/pinglassbot?start=CODE)';
COMMENT ON COLUMN referral_balances.referral_code_web IS 'Referral code for Web app (pinglass.app/?ref=CODE)';
