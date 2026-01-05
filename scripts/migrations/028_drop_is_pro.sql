-- Migration 028: Drop deprecated is_pro column
-- Date: 2026-01-05
-- Purpose: Clean up unused is_pro column (Pro determined by payments now)

-- Step 1: Drop column
ALTER TABLE users DROP COLUMN IF EXISTS is_pro;

-- Step 2: Verify
DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_pro'
  ) INTO col_exists;

  IF col_exists THEN
    RAISE EXCEPTION 'Migration failed: is_pro column still exists';
  END IF;

  RAISE NOTICE 'Migration successful: is_pro column dropped';
END $$;

-- Comment
COMMENT ON TABLE users IS 'Users identified by telegram_user_id. Pro status determined by successful payments.';
