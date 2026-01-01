-- Migration 024: Fix kie_tasks foreign key constraints
-- Issue: Avatar deletion blocked by kie_tasks FK constraints without CASCADE
-- Date: 2026-01-01

-- Fix kie_tasks.avatar_id - add ON DELETE CASCADE
ALTER TABLE kie_tasks
DROP CONSTRAINT IF EXISTS kie_tasks_avatar_id_fkey;

ALTER TABLE kie_tasks
ADD CONSTRAINT kie_tasks_avatar_id_fkey
FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE;

-- Fix kie_tasks.job_id - add ON DELETE CASCADE
ALTER TABLE kie_tasks
DROP CONSTRAINT IF EXISTS kie_tasks_job_id_fkey;

ALTER TABLE kie_tasks
ADD CONSTRAINT kie_tasks_job_id_fkey
FOREIGN KEY (job_id) REFERENCES generation_jobs(id) ON DELETE CASCADE;

-- Fix users.pending_generation_avatar_id - add FK with ON DELETE SET NULL
-- This ensures orphaned references are cleaned up
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'users_pending_generation_avatar_id_fkey'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_pending_generation_avatar_id_fkey
    FOREIGN KEY (pending_generation_avatar_id) REFERENCES avatars(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Fix generation_jobs.payment_id - add ON DELETE SET NULL
ALTER TABLE generation_jobs
DROP CONSTRAINT IF EXISTS generation_jobs_payment_id_fkey;

-- Only add if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_jobs' AND column_name = 'payment_id'
  ) THEN
    ALTER TABLE generation_jobs
    ADD CONSTRAINT generation_jobs_payment_id_fkey
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;
  END IF;
END $$;
