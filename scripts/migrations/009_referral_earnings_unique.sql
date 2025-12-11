-- Migration: Add unique constraint on payment_id in referral_earnings
-- This enables atomic insert with ON CONFLICT DO NOTHING for idempotency
-- Date: 2024-12-11

-- Add unique constraint (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'referral_earnings_payment_id_key'
  ) THEN
    ALTER TABLE referral_earnings
    ADD CONSTRAINT referral_earnings_payment_id_key UNIQUE (payment_id);
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_referral_earnings_payment_id
ON referral_earnings(payment_id);

-- Verify constraint
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'referral_earnings'::regclass;
