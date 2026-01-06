-- Migration 034: User Identities for Account Linking
-- Tracks multiple authentication providers per user (Google, Telegram, Email, etc.)
-- Enables account linking between Telegram Mini App and Web version

BEGIN;

-- Step 1: Create user_identities table
-- This table tracks all linked authentication methods for each user
CREATE TABLE IF NOT EXISTS user_identities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Provider identification
  provider VARCHAR(50) NOT NULL,         -- 'telegram', 'google', 'github', 'email'
  provider_user_id VARCHAR(255) NOT NULL, -- ID from the provider (telegram_user_id, google sub, etc.)

  -- Additional provider data
  provider_email VARCHAR(255),           -- Email from provider (if available)
  provider_name VARCHAR(255),            -- Display name from provider
  provider_avatar_url TEXT,              -- Avatar URL from provider
  provider_metadata JSONB DEFAULT '{}',  -- Additional provider-specific data

  -- Timestamps
  linked_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(provider, provider_user_id),    -- One provider account can only link to one user
  UNIQUE(user_id, provider)              -- One user can only have one account per provider
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_user_identities_user_id
  ON user_identities(user_id);

CREATE INDEX IF NOT EXISTS idx_user_identities_provider_user
  ON user_identities(provider, provider_user_id);

CREATE INDEX IF NOT EXISTS idx_user_identities_provider_email
  ON user_identities(provider_email)
  WHERE provider_email IS NOT NULL;

-- Step 3: Migrate existing Telegram users to user_identities
-- This creates identity records for all existing Telegram users
INSERT INTO user_identities (user_id, provider, provider_user_id, provider_name, linked_at)
SELECT
  id,
  'telegram',
  telegram_user_id::TEXT,
  telegram_username,
  created_at
FROM users
WHERE telegram_user_id IS NOT NULL
ON CONFLICT (provider, provider_user_id) DO NOTHING;

-- Step 4: Create partner_applications table
CREATE TABLE IF NOT EXISTS partner_applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Application details
  channel_url TEXT NOT NULL,
  audience_size VARCHAR(50),             -- '1k-10k', '10k-50k', '50k-100k', '100k+'
  promotion_plan TEXT,

  -- Review status
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  admin_notes TEXT,
  reviewed_by INTEGER REFERENCES admin_users(id),
  reviewed_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Only one pending/approved application per user
  CONSTRAINT unique_active_application
    UNIQUE (user_id, status)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_partner_applications_status
  ON partner_applications(status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_partner_applications_user
  ON partner_applications(user_id);

-- Step 5: Add partner fields to referral_balances if not exists
-- Check and add is_partner column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referral_balances' AND column_name = 'is_partner'
  ) THEN
    ALTER TABLE referral_balances ADD COLUMN is_partner BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Check and add commission_rate column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referral_balances' AND column_name = 'commission_rate'
  ) THEN
    ALTER TABLE referral_balances ADD COLUMN commission_rate DECIMAL(3,2) DEFAULT 0.10;
  END IF;
END $$;

-- Check and add partner_since column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referral_balances' AND column_name = 'partner_since'
  ) THEN
    ALTER TABLE referral_balances ADD COLUMN partner_since TIMESTAMP;
  END IF;
END $$;

COMMIT;

-- Verification queries (run manually)
-- SELECT COUNT(*) FROM user_identities;
-- SELECT provider, COUNT(*) FROM user_identities GROUP BY provider;
