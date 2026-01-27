-- Migration: Partner Users Table for secure partner authentication
-- Date: 2026-01-27
-- Description: Creates partner_users table with email/password auth similar to admin_users

-- Partner users table (mirrors admin_users structure)
CREATE TABLE IF NOT EXISTS partner_users (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Partner sessions table for JWT-based authentication
CREATE TABLE IF NOT EXISTS partner_sessions (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER NOT NULL REFERENCES partner_users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_partner_users_email ON partner_users(email);
CREATE INDEX IF NOT EXISTS idx_partner_users_user_id ON partner_users(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_sessions_partner_id ON partner_sessions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_sessions_token ON partner_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_partner_sessions_expires ON partner_sessions(expires_at);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_partner_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_partner_users_updated_at ON partner_users;
CREATE TRIGGER trigger_partner_users_updated_at
  BEFORE UPDATE ON partner_users
  FOR EACH ROW
  EXECUTE FUNCTION update_partner_users_updated_at();

-- Comment
COMMENT ON TABLE partner_users IS 'Secure partner authentication with email/password';
COMMENT ON TABLE partner_sessions IS 'JWT session storage for partner authentication';
