-- Migration 051: Add endpoint column to qstash_processed_messages
-- Fixes: column "endpoint" of relation "qstash_processed_messages" does not exist
-- The table was created by env-validation.ts with simpler schema before migrations
-- Created: 2026-01-28

-- Add endpoint column if it doesn't exist
ALTER TABLE qstash_processed_messages
ADD COLUMN IF NOT EXISTS endpoint VARCHAR(255);

-- Add job_id column if it doesn't exist (from migration 039)
ALTER TABLE qstash_processed_messages
ADD COLUMN IF NOT EXISTS job_id INTEGER;

-- Add response_status column (from migration 037)
ALTER TABLE qstash_processed_messages
ADD COLUMN IF NOT EXISTS response_status INTEGER;

-- Add metadata column (from migration 037)
ALTER TABLE qstash_processed_messages
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add index on endpoint for debugging
CREATE INDEX IF NOT EXISTS idx_qstash_endpoint ON qstash_processed_messages(endpoint);

-- Add index on job_id if not exists
CREATE INDEX IF NOT EXISTS idx_qstash_job_id ON qstash_processed_messages(job_id);

COMMENT ON COLUMN qstash_processed_messages.endpoint IS 'Which endpoint processed this message (e.g., jobs/process)';
