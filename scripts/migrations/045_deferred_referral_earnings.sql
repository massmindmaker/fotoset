-- Migration 045: Deferred Referral Earnings
-- Date: 2026-01-19
-- Purpose: Implement deferred referral earnings to protect against chargebacks
--
-- New flow:
--   Payment succeeded → createPendingEarning() → status='pending', balance NOT updated
--   Generation completed → creditPendingEarning() → status='credited', balance updated
--   Refund before generation → cancelPendingEarning() → status='cancelled'
--
-- This prevents referrals from being credited before the user actually receives value

BEGIN;

-- Step 1: Add generation_job_id to track which generation triggered the credit
ALTER TABLE referral_earnings
ADD COLUMN IF NOT EXISTS generation_job_id INTEGER REFERENCES generation_jobs(id);

-- Step 2: Add 'cancelled' status (existing: pending, credited, confirmed)
-- First drop existing constraint
ALTER TABLE referral_earnings
DROP CONSTRAINT IF EXISTS referral_earnings_status_check;

-- Add new constraint with all valid statuses
ALTER TABLE referral_earnings
ADD CONSTRAINT referral_earnings_status_check
CHECK (status IN ('pending', 'credited', 'cancelled', 'confirmed'));

-- Step 3: Add credited_at timestamp to track when earnings were credited
ALTER TABLE referral_earnings
ADD COLUMN IF NOT EXISTS credited_at TIMESTAMP;

-- Step 4: Add cancelled_at timestamp and reason for audit
ALTER TABLE referral_earnings
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

ALTER TABLE referral_earnings
ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- Step 5: Create index for finding pending earnings by payment_id
CREATE INDEX IF NOT EXISTS idx_referral_earnings_payment_pending
ON referral_earnings(payment_id, status)
WHERE status = 'pending';

-- Step 6: Create index for generation_job_id lookups
CREATE INDEX IF NOT EXISTS idx_referral_earnings_job_id
ON referral_earnings(generation_job_id)
WHERE generation_job_id IS NOT NULL;

-- Step 7: Add comments for documentation
COMMENT ON COLUMN referral_earnings.generation_job_id IS 'Links earning to the generation job that triggered crediting';
COMMENT ON COLUMN referral_earnings.credited_at IS 'Timestamp when earning was credited to referrer balance';
COMMENT ON COLUMN referral_earnings.cancelled_at IS 'Timestamp when earning was cancelled (e.g., due to refund)';
COMMENT ON COLUMN referral_earnings.cancelled_reason IS 'Reason for cancellation (e.g., refund_before_generation)';

-- Step 8: Create helper function to check if earning can be cancelled
CREATE OR REPLACE FUNCTION can_cancel_referral_earning(p_payment_id INTEGER)
RETURNS TABLE (
  can_cancel BOOLEAN,
  reason TEXT,
  current_status VARCHAR,
  earning_id INTEGER
) AS $$
DECLARE
  v_earning RECORD;
BEGIN
  -- Find the earning for this payment
  SELECT id, status INTO v_earning
  FROM referral_earnings
  WHERE payment_id = p_payment_id;

  earning_id := v_earning.id;
  current_status := v_earning.status;

  IF v_earning.id IS NULL THEN
    can_cancel := TRUE;
    reason := 'No earning found for payment';
    RETURN NEXT;
    RETURN;
  END IF;

  CASE v_earning.status
    WHEN 'pending' THEN
      can_cancel := TRUE;
      reason := 'Earning is pending, can be cancelled';
    WHEN 'credited', 'confirmed' THEN
      can_cancel := FALSE;
      reason := 'Earning already credited to balance, requires manual reversal';
    WHEN 'cancelled' THEN
      can_cancel := TRUE;
      reason := 'Earning already cancelled';
    ELSE
      can_cancel := FALSE;
      reason := 'Unknown status: ' || v_earning.status;
  END CASE;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create audit log table for earning status changes
CREATE TABLE IF NOT EXISTS referral_earning_logs (
  id SERIAL PRIMARY KEY,
  earning_id INTEGER NOT NULL REFERENCES referral_earnings(id) ON DELETE CASCADE,

  -- Change details
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  message TEXT,

  -- Context
  generation_job_id INTEGER REFERENCES generation_jobs(id),
  payment_id INTEGER,

  -- Who/what triggered the change
  actor_type VARCHAR(20) NOT NULL, -- 'cron', 'webhook', 'admin', 'system'
  actor_id INTEGER, -- admin_user.id if actor_type = 'admin'

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_earning_logs_earning
ON referral_earning_logs(earning_id);

-- Step 10: Create trigger for automatic logging
CREATE OR REPLACE FUNCTION log_referral_earning_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO referral_earning_logs (earning_id, old_status, new_status, message, payment_id, actor_type)
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      CASE
        WHEN NEW.status = 'credited' THEN 'Earning credited after successful generation'
        WHEN NEW.status = 'cancelled' THEN 'Earning cancelled: ' || COALESCE(NEW.cancelled_reason, 'unknown reason')
        ELSE 'Status changed to ' || NEW.status
      END,
      NEW.payment_id,
      'system'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_referral_earning_status_change ON referral_earnings;
CREATE TRIGGER trg_referral_earning_status_change
  AFTER UPDATE ON referral_earnings
  FOR EACH ROW
  EXECUTE FUNCTION log_referral_earning_status_change();

COMMIT;

-- Verification queries (run manually after migration)
-- SELECT * FROM can_cancel_referral_earning(123);
-- SELECT status, COUNT(*) FROM referral_earnings GROUP BY status;
