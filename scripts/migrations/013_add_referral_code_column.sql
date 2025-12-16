-- Migration: Add referral_code column to referrals table if missing
-- This ensures compatibility between 004 and 007 migrations
-- Date: 2025-12-16

-- Add referral_code column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referrals' AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE referrals ADD COLUMN referral_code VARCHAR(20);
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

-- Verify column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'referrals';
