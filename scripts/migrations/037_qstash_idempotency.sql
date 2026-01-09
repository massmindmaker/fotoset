-- Migration 037: QStash Idempotency Table
-- Prevents duplicate webhook processing
-- Created: 2026-01-09

-- Table to track processed QStash messages for idempotency
CREATE TABLE IF NOT EXISTS qstash_processed_messages (
  id SERIAL PRIMARY KEY,
  message_id VARCHAR(255) NOT NULL UNIQUE,  -- QStash message ID
  endpoint VARCHAR(255) NOT NULL,           -- Which endpoint processed it
  processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  response_status INTEGER,                   -- HTTP status code returned
  metadata JSONB                             -- Optional debug info
);

-- Index for fast lookups by message_id
CREATE INDEX IF NOT EXISTS idx_qstash_message_id ON qstash_processed_messages(message_id);

-- Index for cleanup of old records
CREATE INDEX IF NOT EXISTS idx_qstash_processed_at ON qstash_processed_messages(processed_at);

-- Auto-cleanup: Delete records older than 7 days (run via cron)
-- DELETE FROM qstash_processed_messages WHERE processed_at < NOW() - INTERVAL '7 days';

COMMENT ON TABLE qstash_processed_messages IS 'Idempotency tracking for QStash webhook processing';
