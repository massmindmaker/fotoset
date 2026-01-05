-- Migration 029: Fix referral_earnings status
-- Date: 2026-01-05
-- Purpose: Mark all existing referral_earnings as 'confirmed' since they were already credited

-- Update all pending earnings to confirmed
-- These earnings were already credited to referral_balances but status was never updated
UPDATE referral_earnings
SET status = 'confirmed'
WHERE status = 'pending';

-- Verify the fix
DO $$
DECLARE
  pending_count INTEGER;
  confirmed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO pending_count FROM referral_earnings WHERE status = 'pending';
  SELECT COUNT(*) INTO confirmed_count FROM referral_earnings WHERE status = 'confirmed';

  IF pending_count > 0 THEN
    RAISE WARNING 'Still have % pending earnings', pending_count;
  END IF;

  RAISE NOTICE 'Migration complete: % confirmed earnings', confirmed_count;
END $$;
