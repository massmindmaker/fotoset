-- Migration: 015_add_indexes
-- Description: Add missing indexes for common query patterns
-- Date: 2025-12-19

-- 1. Add missing indexes for status columns (used in WHERE clauses)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status 
ON payments(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generation_jobs_status 
ON generation_jobs(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_avatars_status 
ON avatars(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_referral_earnings_referred 
ON referral_earnings(referred_id);

-- 2. Partial index for active jobs (performance optimization)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generation_jobs_active 
ON generation_jobs(status) 
WHERE status IN ('pending', 'processing');

-- 3. Composite index for common avatar queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_avatars_user_status 
ON avatars(user_id, status);

-- 4. Fix referral_earnings FK to allow payment deletion
ALTER TABLE referral_earnings 
DROP CONSTRAINT IF EXISTS referral_earnings_payment_id_fkey;

ALTER TABLE referral_earnings 
ADD CONSTRAINT referral_earnings_payment_id_fkey 
FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;

-- 5. Add comment for documentation
COMMENT ON COLUMN referrals.referral_code IS 
  'Optional - added later for tracking. May be NULL for early referrals.';
