-- Migration: Fix telegram_user_id constraint for ON CONFLICT
-- Date: 2024-12-17
-- Problem: Partial unique index doesn't work with ON CONFLICT (column)
-- Solution: Create proper UNIQUE CONSTRAINT

-- Drop the partial index that doesn't work with ON CONFLICT
DROP INDEX IF EXISTS idx_users_telegram_unique;

-- Create proper UNIQUE CONSTRAINT (allows multiple NULLs in PostgreSQL)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_telegram_user_id_unique;
ALTER TABLE users ADD CONSTRAINT users_telegram_user_id_unique UNIQUE (telegram_user_id);

-- Verify
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users' AND indexname LIKE '%telegram%';
