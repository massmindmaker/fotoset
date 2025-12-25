-- Migration 019: Move referral count increment to onboarding completion
-- Date: 2025-12-26
-- Purpose: Simplify referral system - give +1 referral when new user completes onboarding, not at payment

-- Add onboarding completion timestamp
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP;

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_users_onboarding ON users(onboarding_completed_at)
WHERE onboarding_completed_at IS NOT NULL;

-- Comment explaining the new flow
COMMENT ON COLUMN users.onboarding_completed_at IS 'When user completed onboarding. Used to trigger +1 referral count for referrer.';
