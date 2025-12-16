-- Migration: 011_add_user_email
-- Description: Add email column to users table for 54-ФЗ fiscal receipt compliance
-- Date: 2025-12-16

-- Step 1: Add email column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Step 2: Create index for email lookups (optional but improves performance)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Step 3: Add comment for documentation
COMMENT ON COLUMN users.email IS
  'User email address for fiscal receipts (54-ФЗ). Required for payment refunds.';

-- Note: We don't make this column NOT NULL because existing users don't have email.
-- New users will have email captured during payment flow.
