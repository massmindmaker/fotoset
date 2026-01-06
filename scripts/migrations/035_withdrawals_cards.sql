-- Migration 035: Withdrawals and User Cards for T-Bank Payouts
-- Supports automated payouts via T-Bank E2C API
-- Minimum withdrawal: 5000 RUB

BEGIN;

-- Step 1: Create user_cards table
-- Stores card information for T-Bank E2C payouts
CREATE TABLE IF NOT EXISTS user_cards (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- T-Bank card identification
  card_id VARCHAR(255) NOT NULL,          -- T-Bank CardId from AddCard
  card_mask VARCHAR(20) NOT NULL,         -- Masked card number: **** **** **** 1234
  card_type VARCHAR(20),                  -- 'visa', 'mastercard', 'mir'

  -- Card status
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_user_cards_user_id
  ON user_cards(user_id)
  WHERE is_active = TRUE;

-- Ensure only one default card per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_cards_default
  ON user_cards(user_id)
  WHERE is_default = TRUE AND is_active = TRUE;

-- Step 2: Create withdrawals table
-- Tracks all withdrawal requests and their status
CREATE TABLE IF NOT EXISTS withdrawals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Withdrawal details
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 5000), -- Minimum 5000 RUB
  currency VARCHAR(3) DEFAULT 'RUB',

  -- Card information (snapshot at withdrawal time)
  card_id INTEGER REFERENCES user_cards(id),
  card_mask VARCHAR(20) NOT NULL,

  -- T-Bank payout tracking
  tbank_payment_id VARCHAR(255),          -- T-Bank PaymentId
  tbank_order_id VARCHAR(255) UNIQUE,     -- Our unique order ID

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending',   -- pending, processing, completed, failed, cancelled
  error_message TEXT,
  error_code VARCHAR(50),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Idempotency
  idempotency_key VARCHAR(64) UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id
  ON withdrawals(user_id);

CREATE INDEX IF NOT EXISTS idx_withdrawals_status
  ON withdrawals(status)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_withdrawals_tbank_payment
  ON withdrawals(tbank_payment_id)
  WHERE tbank_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawals_created
  ON withdrawals(created_at DESC);

-- Step 3: Create withdrawal_logs table for audit trail
CREATE TABLE IF NOT EXISTS withdrawal_logs (
  id SERIAL PRIMARY KEY,
  withdrawal_id INTEGER NOT NULL REFERENCES withdrawals(id) ON DELETE CASCADE,

  -- Log entry
  status VARCHAR(20) NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}',

  -- Who made the change
  actor_type VARCHAR(20) NOT NULL,        -- 'system', 'admin', 'webhook'
  actor_id INTEGER,                       -- admin_user.id if actor_type = 'admin'

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_logs_withdrawal
  ON withdrawal_logs(withdrawal_id);

-- Step 4: Create function to log withdrawal status changes
CREATE OR REPLACE FUNCTION log_withdrawal_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO withdrawal_logs (withdrawal_id, status, message, actor_type, metadata)
    VALUES (
      NEW.id,
      NEW.status,
      CASE
        WHEN NEW.status = 'processing' THEN 'Withdrawal sent to T-Bank'
        WHEN NEW.status = 'completed' THEN 'Withdrawal completed successfully'
        WHEN NEW.status = 'failed' THEN 'Withdrawal failed: ' || COALESCE(NEW.error_message, 'Unknown error')
        WHEN NEW.status = 'cancelled' THEN 'Withdrawal cancelled'
        ELSE 'Status changed to ' || NEW.status
      END,
      'system',
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'tbank_payment_id', NEW.tbank_payment_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic logging
DROP TRIGGER IF EXISTS trg_withdrawal_status_change ON withdrawals;
CREATE TRIGGER trg_withdrawal_status_change
  AFTER UPDATE ON withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION log_withdrawal_status_change();

-- Step 5: Create view for withdrawal statistics
CREATE OR REPLACE VIEW withdrawal_stats AS
SELECT
  user_id,
  COUNT(*) AS total_withdrawals,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_withdrawals,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_withdrawals,
  SUM(amount) FILTER (WHERE status = 'completed') AS total_withdrawn,
  SUM(amount) FILTER (WHERE status = 'pending') AS pending_amount,
  MAX(completed_at) AS last_withdrawal_at
FROM withdrawals
GROUP BY user_id;

-- Step 6: Add helper function to check if user can withdraw
CREATE OR REPLACE FUNCTION can_user_withdraw(p_user_id INTEGER, p_amount DECIMAL)
RETURNS TABLE (
  can_withdraw BOOLEAN,
  reason TEXT,
  available_balance DECIMAL
) AS $$
DECLARE
  v_balance DECIMAL;
  v_pending DECIMAL;
  v_has_card BOOLEAN;
BEGIN
  -- Get current balance
  SELECT COALESCE(balance, 0) INTO v_balance
  FROM referral_balances
  WHERE user_id = p_user_id;

  -- Get pending withdrawals
  SELECT COALESCE(SUM(amount), 0) INTO v_pending
  FROM withdrawals
  WHERE user_id = p_user_id AND status IN ('pending', 'processing');

  -- Check if user has active card
  SELECT EXISTS(
    SELECT 1 FROM user_cards
    WHERE user_id = p_user_id AND is_active = TRUE
  ) INTO v_has_card;

  -- Return result
  available_balance := v_balance - v_pending;

  IF v_balance IS NULL OR v_balance = 0 THEN
    can_withdraw := FALSE;
    reason := 'Нет реферального баланса';
  ELSIF p_amount < 5000 THEN
    can_withdraw := FALSE;
    reason := 'Минимальная сумма вывода 5000₽';
  ELSIF available_balance < p_amount THEN
    can_withdraw := FALSE;
    reason := 'Недостаточно средств (учтены ожидающие выводы)';
  ELSIF NOT v_has_card THEN
    can_withdraw := FALSE;
    reason := 'Добавьте карту для вывода';
  ELSE
    can_withdraw := TRUE;
    reason := NULL;
  END IF;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Verification queries (run manually)
-- SELECT * FROM can_user_withdraw(1, 5000);
-- SELECT * FROM withdrawal_stats WHERE user_id = 1;
