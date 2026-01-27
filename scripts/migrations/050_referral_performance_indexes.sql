-- Migration 050: Referral System Performance Indexes
-- Created: 2026-01-27
-- Purpose: Add missing indexes for referral panel performance optimization
-- Addresses: Slow /api/referral/stats and /api/referral/code endpoints

-- ============================================================================
-- HIGH: referral_codes table indexes
-- ============================================================================
-- Used in: /api/referral/stats for code lookup and uniqueness check
-- Pattern: WHERE user_id = ? AND is_active = true
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_active
  ON referral_codes(user_id, is_active)
  WHERE is_active = true;

COMMENT ON INDEX idx_referral_codes_user_active IS
  'Optimizes active referral code lookup by user';

-- Pattern: WHERE code = ? (uniqueness check in code generation)
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_code_unique
  ON referral_codes(code);

COMMENT ON INDEX idx_referral_codes_code_unique IS
  'Ensures referral code uniqueness and optimizes lookup';

-- ============================================================================
-- HIGH: referral_balances table indexes
-- ============================================================================
-- Used in: /api/referral/stats, /api/referral/code
-- Pattern: WHERE user_id = ?
-- Note: user_id should already have UNIQUE constraint, but index is still helpful
CREATE INDEX IF NOT EXISTS idx_referral_balances_user_id
  ON referral_balances(user_id);

COMMENT ON INDEX idx_referral_balances_user_id IS
  'Optimizes referral balance lookup by user';

-- ============================================================================
-- MEDIUM: referral_withdrawals table indexes
-- ============================================================================
-- Used in: /api/referral/stats for pending withdrawal calculation
-- Pattern: WHERE user_id = ? AND status IN ('pending', 'processing')
CREATE INDEX IF NOT EXISTS idx_referral_withdrawals_user_pending
  ON referral_withdrawals(user_id, status)
  WHERE status IN ('pending', 'processing');

COMMENT ON INDEX idx_referral_withdrawals_user_pending IS
  'Optimizes pending withdrawal lookup for balance calculations';

-- Pattern: ORDER BY created_at DESC for history
CREATE INDEX IF NOT EXISTS idx_referral_withdrawals_created
  ON referral_withdrawals(user_id, created_at DESC);

COMMENT ON INDEX idx_referral_withdrawals_created IS
  'Optimizes withdrawal history queries';

-- ============================================================================
-- MEDIUM: referrals table indexes
-- ============================================================================
-- Used in: /api/referral/stats for recent referrals with earnings
-- Pattern: WHERE referrer_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_recent
  ON referrals(referrer_id, created_at DESC);

COMMENT ON INDEX idx_referrals_referrer_recent IS
  'Optimizes recent referrals listing for referral panel';

-- ============================================================================
-- Verify indexes created
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 050 complete: Created 6 referral performance indexes';
END $$;
