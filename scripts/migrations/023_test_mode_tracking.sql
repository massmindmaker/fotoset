-- Migration 023: Add test mode tracking
-- Adds is_test_mode column to payments and generation_jobs for filtering

-- Add is_test_mode to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_test_mode BOOLEAN DEFAULT false;

-- Add is_test_mode to generation_jobs
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS is_test_mode BOOLEAN DEFAULT false;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_payments_test_mode ON payments(is_test_mode);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_test_mode ON generation_jobs(is_test_mode);

-- Backfill: mark test payments (DEMO terminal or very small amounts)
UPDATE payments SET is_test_mode = true
WHERE tbank_payment_id LIKE '%DEMO%'
   OR tbank_payment_id LIKE 'TEST%'
   OR amount <= 10;

-- Backfill generation_jobs based on linked payments
UPDATE generation_jobs gj
SET is_test_mode = true
FROM payments p
WHERE gj.payment_id = p.id AND p.is_test_mode = true;
