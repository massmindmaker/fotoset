-- Migration 046: Jump.Finance Integration
-- Date: 2026-01-19
-- Purpose: Add Jump.Finance payout support for self-employed referral partners
--
-- Jump.Finance provides:
-- - SBP payouts to any bank
-- - FNS self-employment verification
-- - Automatic receipts for self-employed (НПД)
-- - Lower fees for verified self-employed (~3% vs 13% NDFL)

BEGIN;

-- Step 1: Add Jump.Finance fields to existing withdrawals table
ALTER TABLE withdrawals
ADD COLUMN IF NOT EXISTS jump_payout_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS jump_receipt_url TEXT,
ADD COLUMN IF NOT EXISTS inn VARCHAR(12),
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS payout_method VARCHAR(20) DEFAULT 'sbp';

-- Step 2: Add fee tracking to withdrawals
ALTER TABLE withdrawals
ADD COLUMN IF NOT EXISTS fee_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fee_percent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payout_amount DECIMAL(10,2);

-- Step 3: Create self-employed verifications table
CREATE TABLE IF NOT EXISTS self_employed_verifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Self-employed data
  inn VARCHAR(12) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  full_name VARCHAR(255),

  -- Verification status
  is_verified BOOLEAN DEFAULT FALSE,
  verification_source VARCHAR(50), -- 'jump', 'manual', 'fns_api'
  verified_at TIMESTAMP,
  expires_at TIMESTAMP, -- Verification valid for 30 days

  -- FNS registration data (if available)
  registration_date DATE,
  region_code VARCHAR(2),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_se_verifications_user
ON self_employed_verifications(user_id);

CREATE INDEX IF NOT EXISTS idx_se_verifications_inn
ON self_employed_verifications(inn);

CREATE INDEX IF NOT EXISTS idx_se_verifications_active
ON self_employed_verifications(user_id)
WHERE is_verified = TRUE AND (expires_at IS NULL OR expires_at > NOW());

-- Step 4: Create Jump webhook logs table
CREATE TABLE IF NOT EXISTS jump_webhook_logs (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  jump_payout_id VARCHAR(255),
  withdrawal_id INTEGER REFERENCES withdrawals(id),
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jump_webhook_logs_payout
ON jump_webhook_logs(jump_payout_id);

CREATE INDEX IF NOT EXISTS idx_jump_webhook_logs_unprocessed
ON jump_webhook_logs(processed)
WHERE processed = FALSE;

-- Step 5: Add indexes for Jump-related lookups
CREATE INDEX IF NOT EXISTS idx_withdrawals_jump_payout
ON withdrawals(jump_payout_id)
WHERE jump_payout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawals_phone
ON withdrawals(phone)
WHERE phone IS NOT NULL;

-- Step 6: Update can_user_withdraw function to support SBP
CREATE OR REPLACE FUNCTION can_user_withdraw_sbp(p_user_id INTEGER, p_amount DECIMAL)
RETURNS TABLE (
  can_withdraw BOOLEAN,
  reason TEXT,
  available_balance DECIMAL,
  is_self_employed BOOLEAN,
  estimated_fee DECIMAL
) AS $$
DECLARE
  v_balance DECIMAL;
  v_pending DECIMAL;
  v_is_se BOOLEAN;
  v_fee_rate DECIMAL;
BEGIN
  -- Get current RUB balance
  SELECT COALESCE(balance_rub, balance, 0) INTO v_balance
  FROM referral_balances
  WHERE user_id = p_user_id;

  -- Get pending withdrawals
  SELECT COALESCE(SUM(amount), 0) INTO v_pending
  FROM withdrawals
  WHERE user_id = p_user_id AND status IN ('pending', 'processing');

  -- Check self-employed status
  SELECT EXISTS(
    SELECT 1 FROM self_employed_verifications
    WHERE user_id = p_user_id
      AND is_verified = TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO v_is_se;

  -- Calculate fee rate (3% for self-employed, ~6% otherwise via Jump)
  v_fee_rate := CASE WHEN v_is_se THEN 0.03 ELSE 0.06 END;

  -- Return result
  available_balance := COALESCE(v_balance, 0) - v_pending;
  is_self_employed := v_is_se;
  estimated_fee := p_amount * v_fee_rate;

  IF v_balance IS NULL OR v_balance = 0 THEN
    can_withdraw := FALSE;
    reason := 'Нет реферального баланса';
  ELSIF p_amount < 5000 THEN
    can_withdraw := FALSE;
    reason := 'Минимальная сумма вывода 5000₽';
  ELSIF available_balance < p_amount THEN
    can_withdraw := FALSE;
    reason := 'Недостаточно средств (учтены ожидающие выводы)';
  ELSE
    can_withdraw := TRUE;
    reason := NULL;
  END IF;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create view for withdrawal statistics with Jump data
CREATE OR REPLACE VIEW withdrawal_stats_v2 AS
SELECT
  w.user_id,
  COUNT(*) AS total_withdrawals,
  COUNT(*) FILTER (WHERE w.status = 'completed') AS completed_withdrawals,
  COUNT(*) FILTER (WHERE w.status = 'pending') AS pending_withdrawals,
  COUNT(*) FILTER (WHERE w.status = 'failed') AS failed_withdrawals,
  SUM(w.amount) FILTER (WHERE w.status = 'completed') AS total_withdrawn,
  SUM(w.payout_amount) FILTER (WHERE w.status = 'completed') AS total_received,
  SUM(w.fee_amount) FILTER (WHERE w.status = 'completed') AS total_fees,
  SUM(w.amount) FILTER (WHERE w.status = 'pending') AS pending_amount,
  MAX(w.completed_at) AS last_withdrawal_at,
  se.is_verified AS is_self_employed,
  se.inn
FROM withdrawals w
LEFT JOIN self_employed_verifications se ON se.user_id = w.user_id
GROUP BY w.user_id, se.is_verified, se.inn;

-- Step 8: Add comments
COMMENT ON TABLE self_employed_verifications IS 'Self-employed (НПД/самозанятый) status verified through Jump.Finance or FNS';
COMMENT ON COLUMN self_employed_verifications.expires_at IS 'Verification expires after 30 days, requiring re-verification';
COMMENT ON COLUMN withdrawals.jump_payout_id IS 'Jump.Finance payout ID for tracking';
COMMENT ON COLUMN withdrawals.jump_receipt_url IS 'URL to fiscal receipt from Jump.Finance';
COMMENT ON COLUMN withdrawals.payout_method IS 'Payment method: sbp (default), card';
COMMENT ON COLUMN withdrawals.fee_amount IS 'Fee amount deducted from withdrawal';
COMMENT ON COLUMN withdrawals.fee_percent IS 'Fee percentage (3% for self-employed, ~6% otherwise)';
COMMENT ON COLUMN withdrawals.payout_amount IS 'Amount received after fees: amount - fee_amount';

-- Step 9: Create partner payout settings table
CREATE TABLE IF NOT EXISTS partner_payout_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Payout preferences
  preferred_method VARCHAR(20) DEFAULT 'sbp', -- 'sbp', 'card'
  sbp_phone VARCHAR(20),
  sbp_bank_id VARCHAR(50), -- For future: specific bank selection

  -- Self-employed data
  inn VARCHAR(12),
  is_self_employed BOOLEAN DEFAULT FALSE,

  -- Notification preferences
  notify_on_payout BOOLEAN DEFAULT TRUE,
  notify_on_earning BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_payout_settings_user
ON partner_payout_settings(user_id);

COMMIT;

-- Verification queries (run manually)
-- SELECT * FROM can_user_withdraw_sbp(1, 5000);
-- SELECT * FROM withdrawal_stats_v2 WHERE user_id = 1;
-- SELECT * FROM self_employed_verifications LIMIT 10;
