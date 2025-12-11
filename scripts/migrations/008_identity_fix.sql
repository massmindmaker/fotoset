-- Migration: Fix Identity System - telegram_user_id as primary identifier
-- Date: 2024-12-11
-- Purpose: Make telegram_user_id unique and handle duplicates

-- Step 1: Find and merge duplicate telegram users
-- This CTE identifies duplicates and keeps the oldest record (lowest id)
DO $$
DECLARE
  dup RECORD;
  keep_id INTEGER;
  remove_ids INTEGER[];
BEGIN
  -- Find telegram_user_ids with multiple records
  FOR dup IN
    SELECT telegram_user_id, array_agg(id ORDER BY id) as user_ids
    FROM users
    WHERE telegram_user_id IS NOT NULL
    GROUP BY telegram_user_id
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the first (oldest) user
    keep_id := dup.user_ids[1];
    remove_ids := dup.user_ids[2:array_length(dup.user_ids, 1)];

    -- Transfer avatars to the kept user
    UPDATE avatars
    SET user_id = keep_id
    WHERE user_id = ANY(remove_ids);

    -- Transfer payments to the kept user
    UPDATE payments
    SET user_id = keep_id
    WHERE user_id = ANY(remove_ids);

    -- Transfer referral codes to the kept user (ignore conflicts)
    UPDATE referral_codes
    SET user_id = keep_id
    WHERE user_id = ANY(remove_ids)
    AND NOT EXISTS (
      SELECT 1 FROM referral_codes rc2
      WHERE rc2.user_id = keep_id AND rc2.code = referral_codes.code
    );

    -- Transfer referral balances (merge amounts)
    UPDATE referral_balances rb_keep
    SET
      balance = rb_keep.balance + COALESCE((
        SELECT SUM(balance) FROM referral_balances
        WHERE user_id = ANY(remove_ids)
      ), 0),
      total_earned = rb_keep.total_earned + COALESCE((
        SELECT SUM(total_earned) FROM referral_balances
        WHERE user_id = ANY(remove_ids)
      ), 0),
      total_withdrawn = rb_keep.total_withdrawn + COALESCE((
        SELECT SUM(total_withdrawn) FROM referral_balances
        WHERE user_id = ANY(remove_ids)
      ), 0),
      referrals_count = rb_keep.referrals_count + COALESCE((
        SELECT SUM(referrals_count) FROM referral_balances
        WHERE user_id = ANY(remove_ids)
      ), 0),
      updated_at = NOW()
    WHERE rb_keep.user_id = keep_id;

    -- Transfer referrals where user was referrer
    UPDATE referrals
    SET referrer_id = keep_id
    WHERE referrer_id = ANY(remove_ids);

    -- Transfer referrals where user was referred
    UPDATE referrals
    SET referred_id = keep_id
    WHERE referred_id = ANY(remove_ids);

    -- Transfer referral earnings
    UPDATE referral_earnings
    SET referrer_id = keep_id
    WHERE referrer_id = ANY(remove_ids);

    UPDATE referral_earnings
    SET referred_id = keep_id
    WHERE referred_id = ANY(remove_ids);

    -- Transfer withdrawals
    UPDATE referral_withdrawals
    SET user_id = keep_id
    WHERE user_id = ANY(remove_ids);

    -- Transfer photo favorites
    UPDATE photo_favorites
    SET user_id = keep_id
    WHERE user_id = ANY(remove_ids)
    AND NOT EXISTS (
      SELECT 1 FROM photo_favorites pf2
      WHERE pf2.user_id = keep_id AND pf2.photo_id = photo_favorites.photo_id
    );

    -- Transfer shared galleries
    UPDATE shared_galleries
    SET user_id = keep_id
    WHERE user_id = ANY(remove_ids);

    -- Update is_pro status (keep true if any was pro)
    UPDATE users
    SET is_pro = TRUE
    WHERE id = keep_id
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = ANY(remove_ids) AND is_pro = TRUE
    );

    -- Delete duplicate users
    DELETE FROM referral_balances WHERE user_id = ANY(remove_ids);
    DELETE FROM referral_codes WHERE user_id = ANY(remove_ids);
    DELETE FROM photo_favorites WHERE user_id = ANY(remove_ids);
    DELETE FROM users WHERE id = ANY(remove_ids);

    RAISE NOTICE 'Merged telegram_user_id % - kept user %, removed users %',
      dup.telegram_user_id, keep_id, remove_ids;
  END LOOP;
END $$;

-- Step 2: Add unique constraint on telegram_user_id (allows NULL)
-- PostgreSQL UNIQUE constraint allows multiple NULLs by default
DROP INDEX IF EXISTS idx_users_telegram;
CREATE UNIQUE INDEX idx_users_telegram_unique ON users(telegram_user_id)
WHERE telegram_user_id IS NOT NULL;

-- Step 3: Add comment explaining the identity model
COMMENT ON COLUMN users.telegram_user_id IS
  'Primary identifier for Telegram users. Used for notifications and cross-device sync. UNIQUE where NOT NULL.';

COMMENT ON COLUMN users.device_id IS
  'Secondary identifier for web-only users. May be updated when telegram_user_id matches.';

-- Step 4: Create index for faster device_id lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id);
