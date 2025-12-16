-- Migration: 012_avatar_idempotency
-- Description: Add idempotency_key to avatars table to prevent race condition duplicates
-- Date: 2025-12-16

-- Step 1: Add idempotency_key column
ALTER TABLE avatars ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

-- Step 2: Create unique partial index (only for non-null values)
-- This allows multiple NULL values while enforcing uniqueness for non-null keys
CREATE UNIQUE INDEX IF NOT EXISTS idx_avatars_idempotency_key
  ON avatars(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Step 3: Add comment for documentation
COMMENT ON COLUMN avatars.idempotency_key IS
  'Idempotency key for atomic avatar creation. Format: {user_id}-{frontend_avatar_id}';
