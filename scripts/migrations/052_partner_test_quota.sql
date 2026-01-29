-- Migration 052: Partner Test Generations Quota
-- Adds fields to track partner's test generation usage

-- Add quota fields to referral_balances (partners already have is_partner=true there)
ALTER TABLE referral_balances 
ADD COLUMN IF NOT EXISTS test_generations_limit INT DEFAULT 200,
ADD COLUMN IF NOT EXISTS test_generations_used INT DEFAULT 0;

-- Comment for documentation
COMMENT ON COLUMN referral_balances.test_generations_limit IS 'Maximum test generations allowed for partner (200 default)';
COMMENT ON COLUMN referral_balances.test_generations_used IS 'Number of test generations used by partner';

-- Index for quick partner lookup
CREATE INDEX IF NOT EXISTS idx_referral_balances_partner_quota 
ON referral_balances(user_id) 
WHERE is_partner = TRUE;
