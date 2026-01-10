-- Migration 039: Add job_id to qstash_processed_messages
-- Fixes column mismatch between migration 037 schema and app code
-- Created: 2026-01-10

-- Add job_id column for tracking which generation job was processed
ALTER TABLE qstash_processed_messages
ADD COLUMN IF NOT EXISTS job_id INTEGER;

-- Make endpoint column nullable (code wasn't passing it)
ALTER TABLE qstash_processed_messages
ALTER COLUMN endpoint DROP NOT NULL;

-- Add index on job_id for debugging lookups
CREATE INDEX IF NOT EXISTS idx_qstash_job_id ON qstash_processed_messages(job_id);

COMMENT ON COLUMN qstash_processed_messages.job_id IS 'Generation job ID that was processed (optional, for debugging)';
