-- Migration 033: Hybrid Auth Support
-- Adds support for web authentication via Neon Auth while maintaining Telegram compatibility
--
-- IMPORTANT: This is a backward-compatible migration
-- - telegram_user_id becomes nullable (was implicitly required)
-- - Adds neon_auth_id for web users
-- - Constraint ensures at least one identity exists

BEGIN;

-- Step 1: Make telegram_user_id nullable (for web-only users)
-- This is safe because we'll add a CHECK constraint to ensure at least one identity exists
ALTER TABLE users
  ALTER COLUMN telegram_user_id DROP NOT NULL;

-- Step 2: Add columns for web authentication
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS neon_auth_id VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50); -- 'telegram', 'google', 'email'

-- Step 3: Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_users_neon_auth_id
  ON users(neon_auth_id)
  WHERE neon_auth_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_auth_provider
  ON users(auth_provider)
  WHERE auth_provider IS NOT NULL;

-- Step 4: Add constraint to ensure user has at least one identity
-- A user must have either telegram_user_id OR neon_auth_id (or both for linked accounts)
ALTER TABLE users
  ADD CONSTRAINT chk_user_has_identity
  CHECK (telegram_user_id IS NOT NULL OR neon_auth_id IS NOT NULL);

-- Step 5: Update existing users to have auth_provider = 'telegram'
UPDATE users
SET auth_provider = 'telegram'
WHERE telegram_user_id IS NOT NULL
  AND auth_provider IS NULL;

-- Step 6: Create link_tokens table for account linking
CREATE TABLE IF NOT EXISTS link_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  token_type VARCHAR(20) NOT NULL, -- 'web_to_tg', 'tg_to_web'
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_link_tokens_token
  ON link_tokens(token)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_link_tokens_expires
  ON link_tokens(expires_at)
  WHERE used_at IS NULL;

COMMIT;

-- Verification query (run manually after migration)
-- SELECT
--   COUNT(*) as total_users,
--   COUNT(telegram_user_id) as telegram_users,
--   COUNT(neon_auth_id) as web_users,
--   COUNT(CASE WHEN telegram_user_id IS NOT NULL AND neon_auth_id IS NOT NULL THEN 1 END) as linked_users
-- FROM users;
