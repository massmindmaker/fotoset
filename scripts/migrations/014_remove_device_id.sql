-- Migration: Remove device_id completely (Telegram-only auth)
-- Date: 2025-12-19
-- Purpose: Simplify user identity to telegram_user_id only

-- Step 1: Verify no orphaned users
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM users
  WHERE telegram_user_id IS NULL;

  IF orphaned_count > 0 THEN
    RAISE EXCEPTION 'Cannot remove device_id: % users without telegram_user_id found', orphaned_count;
  END IF;

  RAISE NOTICE 'Pre-check passed: No orphaned users';
END $$;

-- Step 2: Drop indexes
DROP INDEX IF EXISTS idx_users_device_id;

-- Step 3: Drop unique constraint (if exists separately)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_device_id_key;

-- Step 4: Drop column
ALTER TABLE users DROP COLUMN IF EXISTS device_id;

-- Step 5: Add comment explaining new model
COMMENT ON COLUMN users.telegram_user_id IS
  'Primary and ONLY identifier for users. All users must have Telegram account. UNIQUE.';

-- Step 6: Ensure telegram_user_id is NOT NULL
ALTER TABLE users ALTER COLUMN telegram_user_id SET NOT NULL;

-- Step 7: Verify migration
DO $$
DECLARE
  device_column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'device_id'
  ) INTO device_column_exists;

  IF device_column_exists THEN
    RAISE EXCEPTION 'Migration failed: device_id column still exists';
  END IF;

  RAISE NOTICE 'Migration successful: device_id removed';
END $$;
