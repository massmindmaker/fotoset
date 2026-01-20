-- Fix: Add referral code columns step by step

-- Add all three columns
ALTER TABLE referral_balances ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20);
ALTER TABLE referral_balances ADD COLUMN IF NOT EXISTS referral_code_telegram VARCHAR(20);
ALTER TABLE referral_balances ADD COLUMN IF NOT EXISTS referral_code_web VARCHAR(20);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_balances_code_telegram
ON referral_balances(referral_code_telegram)
WHERE referral_code_telegram IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_balances_code_web
ON referral_balances(referral_code_web)
WHERE referral_code_web IS NOT NULL;
