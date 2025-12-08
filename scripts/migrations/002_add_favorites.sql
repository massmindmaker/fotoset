-- Migration: Add favorites and improve photo storage
-- Date: 2024-12-06

-- Table for storing user favorites (server-side sync)
CREATE TABLE IF NOT EXISTS photo_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    photo_id INTEGER NOT NULL REFERENCES generated_photos(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, photo_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_photo_favorites_user_id ON photo_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_favorites_photo_id ON photo_favorites(photo_id);

-- Table for shared galleries (temporary links)
CREATE TABLE IF NOT EXISTS shared_galleries (
    id SERIAL PRIMARY KEY,
    share_token VARCHAR(64) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    avatar_id INTEGER REFERENCES avatars(id) ON DELETE CASCADE,
    photo_ids INTEGER[] NOT NULL DEFAULT '{}',
    title VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for share token lookup
CREATE INDEX IF NOT EXISTS idx_shared_galleries_token ON shared_galleries(share_token);
CREATE INDEX IF NOT EXISTS idx_shared_galleries_expires ON shared_galleries(expires_at);

-- Add download_count to generated_photos for analytics
ALTER TABLE generated_photos
ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;

-- Add share_count to generated_photos for analytics
ALTER TABLE generated_photos
ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;

-- Update payment table to support multiple tiers
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS tier_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS photo_count INTEGER;

-- Migrate existing payments (assume standard tier)
UPDATE payments
SET tier_id = 'standard', photo_count = 15
WHERE tier_id IS NULL;
