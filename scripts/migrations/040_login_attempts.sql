-- Migration 040: Login attempts tracking for rate limiting
-- Prevents brute-force attacks on admin login
-- Created: 2026-01-10

CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL,  -- IPv4 or IPv6
  email VARCHAR(255),                -- Optional, for tracking specific accounts
  success BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for rate limiting lookups (by IP in last N minutes)
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time
ON login_attempts(ip_address, attempted_at DESC);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_login_attempts_time
ON login_attempts(attempted_at);

-- Cleanup old records (run via cron)
-- DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '24 hours';

COMMENT ON TABLE login_attempts IS 'Tracks login attempts for rate limiting';
