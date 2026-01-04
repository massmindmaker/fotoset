-- Migration 020: Partner Program
-- Adds partner applications and dynamic commission rates

-- 1. Add commission_rate to referral_balances (default 10% for regular referrals)
ALTER TABLE referral_balances
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,4) DEFAULT 0.10,
ADD COLUMN IF NOT EXISTS is_partner BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS partner_approved_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS partner_approved_by VARCHAR(255) NULL;

-- 2. Create partner applications table
CREATE TABLE IF NOT EXISTS partner_applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),

  -- Contact info
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  telegram_username VARCHAR(255),

  -- Business info
  audience_size VARCHAR(50),           -- 'small' (<1k), 'medium' (1k-10k), 'large' (10k-100k), 'huge' (>100k)
  audience_type VARCHAR(100),          -- 'bloggers', 'photographers', 'designers', 'marketers', 'other'
  promotion_channels TEXT,             -- How they plan to promote
  website_url VARCHAR(500),
  social_links TEXT,                   -- JSON array of social links

  -- Application
  message TEXT,                        -- Why they want to be partner
  expected_referrals INTEGER,          -- Monthly expected referrals

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  rejection_reason TEXT,

  -- Admin
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  admin_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, status) -- Can only have one pending application per user
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_partner_applications_user_id ON partner_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON partner_applications(status);
CREATE INDEX IF NOT EXISTS idx_partner_applications_created_at ON partner_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_balances_is_partner ON referral_balances(is_partner) WHERE is_partner = TRUE;

-- 4. Update existing partners to default 10%
UPDATE referral_balances SET commission_rate = 0.10 WHERE commission_rate IS NULL;

-- Comments
COMMENT ON COLUMN referral_balances.commission_rate IS 'Commission rate: 0.10 (10%) for regular referrals, 0.50 (50%) for partners';
COMMENT ON COLUMN referral_balances.is_partner IS 'TRUE if user is approved partner with 50% commission';
COMMENT ON TABLE partner_applications IS 'Partner program applications - users apply for 50% commission rate';
