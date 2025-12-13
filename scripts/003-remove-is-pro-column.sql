-- Migration: Remove is_pro column from users table
-- Date: 2024-12-13
-- Description: The is_pro subscription model is not used in this project.
-- Payment validation is done by checking successful payments in the payments table.

-- Step 1: Drop the column if it exists
ALTER TABLE users DROP COLUMN IF EXISTS is_pro;

-- Step 2: Verify the change
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'users';
