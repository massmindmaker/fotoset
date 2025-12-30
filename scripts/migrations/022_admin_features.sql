-- Migration 022: Admin Panel Features
-- Created: 2025-12-31
-- Purpose: PhotoPacks, Saved Prompts, Discounts, T-Bank settings, Telegram username

-- ============================================
-- PART 1: Add telegram_username to users
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_users_telegram_username ON users(telegram_username);

-- ============================================
-- PART 2: Saved Prompts
-- ============================================
CREATE TABLE IF NOT EXISTS saved_prompts (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  style_id VARCHAR(50),
  preview_url TEXT,
  is_favorite BOOLEAN DEFAULT false,
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_prompts_admin ON saved_prompts(admin_id);
CREATE INDEX IF NOT EXISTS idx_saved_prompts_style ON saved_prompts(style_id);
CREATE INDEX IF NOT EXISTS idx_saved_prompts_favorite ON saved_prompts(is_favorite);

-- ============================================
-- PART 3: Photo Packs
-- ============================================
CREATE TABLE IF NOT EXISTS photo_packs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pack_items (
  id SERIAL PRIMARY KEY,
  pack_id INTEGER REFERENCES photo_packs(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  prompt TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photo_packs_admin ON photo_packs(admin_id);
CREATE INDEX IF NOT EXISTS idx_photo_packs_active ON photo_packs(is_active);
CREATE INDEX IF NOT EXISTS idx_pack_items_pack ON pack_items(pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_items_position ON pack_items(pack_id, position);

-- ============================================
-- PART 4: Promo Codes / Discounts
-- ============================================
CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  min_amount DECIMAL(10,2) DEFAULT 0,
  max_discount DECIMAL(10,2),
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  tier_ids TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES admin_users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_code_usages (
  id SERIAL PRIMARY KEY,
  promo_code_id INTEGER REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  original_amount DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) NOT NULL,
  final_amount DECIMAL(10,2) NOT NULL,
  used_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active, valid_until);
CREATE INDEX IF NOT EXISTS idx_promo_usages_code ON promo_code_usages(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_usages_user ON promo_code_usages(user_id);

-- ============================================
-- PART 5: Admin Settings (T-Bank mode, etc)
-- ============================================
CREATE TABLE IF NOT EXISTS admin_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by INTEGER REFERENCES admin_users(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default T-Bank settings
INSERT INTO admin_settings (key, value, description) VALUES
('tbank_mode', '{"mode": "test"}', 'T-Bank payment mode: test or production'),
('tbank_test_credentials', '{"terminal_key": "", "password": ""}', 'T-Bank test environment credentials'),
('tbank_prod_credentials', '{"terminal_key": "", "password": ""}', 'T-Bank production environment credentials')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(key);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE saved_prompts IS 'Admin saved prompts for quick reuse';
COMMENT ON TABLE photo_packs IS 'Photo pack collections for generation';
COMMENT ON TABLE pack_items IS 'Individual photos in a pack';
COMMENT ON TABLE promo_codes IS 'Discount promo codes';
COMMENT ON TABLE promo_code_usages IS 'Promo code usage history';
COMMENT ON TABLE admin_settings IS 'Admin panel configuration settings';
