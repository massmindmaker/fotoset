-- Migration 020: Admin Actions Audit Log
-- Created: 2025-12-30
-- Purpose: Track admin panel operations for security and audit compliance

CREATE TABLE IF NOT EXISTS admin_actions (
  id SERIAL PRIMARY KEY,
  admin_telegram_id BIGINT NOT NULL,
  action_type VARCHAR(50) NOT NULL, -- 'REFUND_CREATED', 'PAYMENT_VIEWED', etc.
  entity_type VARCHAR(50) NOT NULL, -- 'payment', 'user', etc.
  entity_id INTEGER NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_telegram_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_entity ON admin_actions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC);

-- Comments
COMMENT ON TABLE admin_actions IS 'Audit log for admin panel operations';
COMMENT ON COLUMN admin_actions.action_type IS 'Type of action performed (e.g., REFUND_CREATED, PAYMENT_VIEWED)';
COMMENT ON COLUMN admin_actions.entity_type IS 'Type of entity affected (e.g., payment, user)';
COMMENT ON COLUMN admin_actions.entity_id IS 'ID of the affected entity';
COMMENT ON COLUMN admin_actions.details IS 'JSON details about the action (amounts, reasons, etc.)';
