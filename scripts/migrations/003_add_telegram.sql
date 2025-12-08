-- Migration: Add Telegram integration
-- Date: 2024-12-07

-- Table for storing Telegram sessions (linking device_id to chat_id)
CREATE TABLE IF NOT EXISTS telegram_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    telegram_chat_id BIGINT UNIQUE NOT NULL,
    telegram_username VARCHAR(255),
    linked_at TIMESTAMP DEFAULT NOW(),
    last_activity TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_chat_id ON telegram_sessions(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_user_id ON telegram_sessions(user_id);

-- Table for pending link codes (for web-to-telegram linking)
CREATE TABLE IF NOT EXISTS telegram_link_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(8) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for code lookup
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_code ON telegram_link_codes(code);
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_expires ON telegram_link_codes(expires_at);

-- Table for queued messages (photos to send to telegram)
CREATE TABLE IF NOT EXISTS telegram_message_queue (
    id SERIAL PRIMARY KEY,
    telegram_chat_id BIGINT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'photo',
    photo_url TEXT,
    caption TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    sent_at TIMESTAMP
);

-- Index for queue processing
CREATE INDEX IF NOT EXISTS idx_telegram_queue_status ON telegram_message_queue(status);
CREATE INDEX IF NOT EXISTS idx_telegram_queue_chat_id ON telegram_message_queue(telegram_chat_id);
