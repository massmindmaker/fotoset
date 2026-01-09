-- Migration: Add telegram_broadcasts table
-- Date: 2026-01-08
-- Description: Support for mass messaging in admin panel

-- Broadcasts table
CREATE TABLE IF NOT EXISTS telegram_broadcasts (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  photo_url TEXT,
  parse_mode VARCHAR(20) DEFAULT 'HTML',
  target_type VARCHAR(20) NOT NULL, -- 'all', 'paid', 'active', 'specific'
  target_count INTEGER DEFAULT 0,
  queued_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sending', 'completed', 'failed'
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Add broadcast_id to telegram_message_queue
ALTER TABLE telegram_message_queue
ADD COLUMN IF NOT EXISTS broadcast_id INTEGER REFERENCES telegram_broadcasts(id);

-- Index for broadcast lookup
CREATE INDEX IF NOT EXISTS idx_telegram_message_queue_broadcast
ON telegram_message_queue(broadcast_id) WHERE broadcast_id IS NOT NULL;

-- Index for broadcasts by status
CREATE INDEX IF NOT EXISTS idx_telegram_broadcasts_status
ON telegram_broadcasts(status, created_at DESC);
