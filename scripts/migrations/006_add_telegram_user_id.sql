-- Migration: Add Telegram User ID for notifications
-- Date: 2024-12-10
-- Purpose: Store Telegram user ID for sending notifications when photos are ready

ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT;

-- Index for efficient lookup by telegram_user_id
CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_user_id);

COMMENT ON COLUMN users.telegram_user_id IS 'Telegram user ID for sending generation notifications';
