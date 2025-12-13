-- Migration: 010_webhook_logs
-- Description: Add webhook_logs table for payment diagnostics
-- Created: 2024-12-14

-- Table for logging all incoming webhooks
CREATE TABLE IF NOT EXISTS webhook_logs (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL DEFAULT 'tbank',
  event_type VARCHAR(100),
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON webhook_logs(source);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON webhook_logs(event_type);

-- Comment for documentation
COMMENT ON TABLE webhook_logs IS 'Stores all incoming webhook notifications for diagnostics and audit';
COMMENT ON COLUMN webhook_logs.source IS 'Source of webhook: tbank, telegram, etc.';
COMMENT ON COLUMN webhook_logs.event_type IS 'Type of event: CONFIRMED, REJECTED, etc.';
COMMENT ON COLUMN webhook_logs.payload IS 'Full JSON payload of the webhook';
COMMENT ON COLUMN webhook_logs.processed IS 'Whether the webhook was successfully processed';
COMMENT ON COLUMN webhook_logs.error_message IS 'Error message if processing failed';
