-- Migration 041: Add TON wallet address to users table
-- For TonConnect integration - store connected wallet address
-- Created: 2026-01-10

-- Add wallet address column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS ton_wallet_address VARCHAR(48);

-- Index for wallet address lookups
CREATE INDEX IF NOT EXISTS idx_users_ton_wallet ON users(ton_wallet_address) WHERE ton_wallet_address IS NOT NULL;

-- Add timestamp for when wallet was connected
ALTER TABLE users ADD COLUMN IF NOT EXISTS ton_wallet_connected_at TIMESTAMP;

COMMENT ON COLUMN users.ton_wallet_address IS 'Connected TON wallet address via TonConnect';
COMMENT ON COLUMN users.ton_wallet_connected_at IS 'When the TON wallet was connected';
