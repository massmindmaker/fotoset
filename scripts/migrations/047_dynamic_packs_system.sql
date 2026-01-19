-- Migration 047: Dynamic Packs System
-- Created: 2026-01-19
-- Purpose: Transform PinGlass from hardcoded prompts to dynamic pack marketplace
--          with partner moderation support

-- =============================================
-- PART 1: Extend photo_packs table
-- =============================================

-- Ownership and moderation
ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS owner_type VARCHAR(20) DEFAULT 'admin'
  CHECK (owner_type IN ('admin', 'partner'));
ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS partner_user_id INTEGER REFERENCES users(id);
ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'approved'
  CHECK (moderation_status IN ('draft', 'pending', 'approved', 'rejected'));
ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES admin_users(id);
ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- UI metadata
ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS slug VARCHAR(100) UNIQUE;
ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS preview_images TEXT[];
ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS icon_emoji VARCHAR(10) DEFAULT '🎨';
ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 100;
ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_packs_active_approved ON photo_packs(is_active, moderation_status)
  WHERE is_active = TRUE AND moderation_status = 'approved';
CREATE INDEX IF NOT EXISTS idx_packs_partner ON photo_packs(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_packs_slug ON photo_packs(slug);
CREATE INDEX IF NOT EXISTS idx_packs_moderation ON photo_packs(moderation_status, submitted_at)
  WHERE moderation_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_packs_sort ON photo_packs(sort_order, is_featured DESC);

-- =============================================
-- PART 2: pack_prompts table (CRITICAL!)
-- =============================================

CREATE TABLE IF NOT EXISTS pack_prompts (
  id SERIAL PRIMARY KEY,
  pack_id INTEGER NOT NULL REFERENCES photo_packs(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  style_prefix TEXT,
  style_suffix TEXT,
  preview_url TEXT,
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pack_prompts_pack ON pack_prompts(pack_id, position);
CREATE INDEX IF NOT EXISTS idx_pack_prompts_active ON pack_prompts(pack_id) WHERE is_active = TRUE;

COMMENT ON TABLE pack_prompts IS 'Individual prompts within a photo pack for dynamic generation';

-- =============================================
-- PART 3: Link users to active pack
-- =============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS active_pack_id INTEGER REFERENCES photo_packs(id);
CREATE INDEX IF NOT EXISTS idx_users_active_pack ON users(active_pack_id);

-- =============================================
-- PART 4: Link generation_jobs to packs (CRITICAL!)
-- =============================================

-- Add pack_id column to generation_jobs
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS pack_id INTEGER REFERENCES photo_packs(id);

-- Add used_prompt_ids array for atomic reservation
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS used_prompt_ids INTEGER[];

CREATE INDEX IF NOT EXISTS idx_generation_jobs_pack ON generation_jobs(pack_id);

-- =============================================
-- PART 5: Link kie_tasks to pack_prompts
-- =============================================

ALTER TABLE kie_tasks ADD COLUMN IF NOT EXISTS pack_prompt_id INTEGER REFERENCES pack_prompts(id);
CREATE INDEX IF NOT EXISTS idx_kie_tasks_pack_prompt ON kie_tasks(pack_prompt_id);

-- =============================================
-- PART 6: Link generated_photos to pack_prompts
-- =============================================

ALTER TABLE generated_photos ADD COLUMN IF NOT EXISTS pack_prompt_id INTEGER REFERENCES pack_prompts(id);
CREATE INDEX IF NOT EXISTS idx_generated_photos_pack_prompt ON generated_photos(pack_prompt_id);

-- =============================================
-- PART 7: Pack usage statistics
-- =============================================

CREATE TABLE IF NOT EXISTS pack_usage_stats (
  id SERIAL PRIMARY KEY,
  pack_id INTEGER NOT NULL REFERENCES photo_packs(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  generation_job_id INTEGER REFERENCES generation_jobs(id),
  photo_count INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pack_usage_pack ON pack_usage_stats(pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_usage_created ON pack_usage_stats(created_at DESC);

COMMENT ON TABLE pack_usage_stats IS 'Tracks pack usage for statistics and partner analytics';

-- =============================================
-- PART 8: Create default PinGlass pack
-- =============================================

-- Insert PinGlass pack if not exists
INSERT INTO photo_packs (
  name,
  slug,
  description,
  owner_type,
  moderation_status,
  is_active,
  is_featured,
  sort_order,
  icon_emoji,
  preview_images
) VALUES (
  'PinGlass Premium',
  'pinglass',
  'AI-фотографии премиум качества в стиле Vogue/GQ/Elle. 23 уникальных образа от профессионального до креативного.',
  'admin',
  'approved',
  TRUE,
  TRUE,
  1,
  '🌸',
  ARRAY[
    '/optimized/demo/Screenshot_1.webp',
    '/optimized/demo/Screenshot_2.webp',
    '/optimized/demo/Screenshot_3.webp',
    '/optimized/demo/Screenshot_4.webp'
  ]
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_featured = EXCLUDED.is_featured,
  sort_order = EXCLUDED.sort_order;

-- =============================================
-- PART 9: Comments
-- =============================================

COMMENT ON COLUMN photo_packs.owner_type IS 'admin = official pack, partner = user-created';
COMMENT ON COLUMN photo_packs.moderation_status IS 'draft = editing, pending = waiting review, approved = public, rejected = needs changes';
COMMENT ON COLUMN photo_packs.slug IS 'URL-friendly unique identifier';
COMMENT ON COLUMN photo_packs.preview_images IS 'Array of 4 preview image URLs for collage display';
COMMENT ON COLUMN photo_packs.usage_count IS 'Total generations using this pack';
COMMENT ON COLUMN generation_jobs.pack_id IS 'Photo pack used for this generation';
COMMENT ON COLUMN generation_jobs.used_prompt_ids IS 'Array of pack_prompt IDs reserved for this job';
COMMENT ON COLUMN kie_tasks.pack_prompt_id IS 'Reference to specific prompt in pack_prompts';
COMMENT ON COLUMN generated_photos.pack_prompt_id IS 'Reference to prompt for filtering used prompts';
COMMENT ON COLUMN users.active_pack_id IS 'Currently selected photo pack for new generations';
