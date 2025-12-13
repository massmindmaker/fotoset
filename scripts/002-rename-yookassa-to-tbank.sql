-- Migration: Rename yookassa_payment_id to tbank_payment_id
-- Date: 2024-12-13
-- Description: Rename column to reflect actual payment provider (T-Bank, not YooKassa)

-- Step 1: Rename the column
ALTER TABLE payments
RENAME COLUMN yookassa_payment_id TO tbank_payment_id;

-- Step 2: Update the index name if it exists
DROP INDEX IF EXISTS idx_payments_payment_id;
CREATE INDEX idx_payments_tbank_id ON payments(tbank_payment_id);

-- Step 3: Verify the change
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'payments' AND column_name = 'tbank_payment_id';
