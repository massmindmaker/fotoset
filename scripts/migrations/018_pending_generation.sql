-- Migration 018: Add pending_generation fields to users table
-- After successful payment, store generation params in DB
-- So generation can start even after Telegram WebApp redirect

-- Add pending generation fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_generation_tier VARCHAR(20) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_generation_avatar_id INTEGER DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_generation_at TIMESTAMP DEFAULT NULL;

-- Index for fast lookup of pending generations
CREATE INDEX IF NOT EXISTS idx_users_pending_generation ON users(pending_generation_tier) WHERE pending_generation_tier IS NOT NULL;

COMMENT ON COLUMN users.pending_generation_tier IS 'Tier for pending generation (starter/standard/premium) - set after payment success';
COMMENT ON COLUMN users.pending_generation_avatar_id IS 'Avatar ID for pending generation - set after payment success';
COMMENT ON COLUMN users.pending_generation_at IS 'When the generation was scheduled - for expiry check';
