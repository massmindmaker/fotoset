-- Migration 038: Add FK constraint from generation_jobs to avatars
-- Ensures data integrity and enables ON DELETE CASCADE
-- Created: 2026-01-10

-- First, clean up any orphaned records (generation_jobs with invalid avatar_id)
DELETE FROM generation_jobs gj
WHERE NOT EXISTS (
  SELECT 1 FROM avatars a WHERE a.id = gj.avatar_id
);

-- Add the foreign key constraint with CASCADE delete
-- This means when an avatar is deleted, all its generation jobs are automatically deleted
ALTER TABLE generation_jobs
ADD CONSTRAINT fk_generation_jobs_avatar
FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE;

-- Add index on avatar_id for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_generation_jobs_avatar_id ON generation_jobs(avatar_id);

COMMENT ON CONSTRAINT fk_generation_jobs_avatar ON generation_jobs IS 'Ensures generation jobs always reference valid avatars';
