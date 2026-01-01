-- Migration 026: Payment-Generation Binding
-- Ensures each generation is tied to a specific payment (one payment = one generation)

-- Add generation_consumed field to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS generation_consumed BOOLEAN DEFAULT FALSE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS consumed_avatar_id INTEGER REFERENCES avatars(id);

-- Create index for faster lookup of available payments
CREATE INDEX IF NOT EXISTS idx_payments_available
ON payments(user_id, status, generation_consumed)
WHERE status = 'succeeded' AND generation_consumed = FALSE;

-- Mark existing payments as consumed if they have linked generation jobs
-- This ensures existing data is consistent
UPDATE payments p
SET generation_consumed = TRUE,
    consumed_at = gj.created_at,
    consumed_avatar_id = gj.avatar_id
FROM generation_jobs gj
WHERE gj.payment_id = p.id
  AND p.generation_consumed = FALSE;

-- For payments without linked jobs but with generations by the same user within 1 day
-- Mark them as consumed to prevent abuse of historical payments
UPDATE payments p
SET generation_consumed = TRUE,
    consumed_at = (
      SELECT MIN(gj.created_at)
      FROM generation_jobs gj
      JOIN avatars a ON a.id = gj.avatar_id
      WHERE a.user_id = p.user_id
        AND gj.created_at >= p.created_at
        AND gj.created_at <= p.created_at + interval '1 day'
    )
WHERE p.status = 'succeeded'
  AND p.generation_consumed = FALSE
  AND EXISTS (
    SELECT 1
    FROM generation_jobs gj
    JOIN avatars a ON a.id = gj.avatar_id
    WHERE a.user_id = p.user_id
      AND gj.created_at >= p.created_at
      AND gj.created_at <= p.created_at + interval '1 day'
  );

-- Add comment explaining the constraint
COMMENT ON COLUMN payments.generation_consumed IS 'TRUE if this payment has been used to start a generation. Prevents unlimited generations from single payment.';
COMMENT ON COLUMN payments.consumed_at IS 'Timestamp when the payment was consumed for generation';
COMMENT ON COLUMN payments.consumed_avatar_id IS 'Avatar ID for which this payment was used';
