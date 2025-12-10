-- Migration: Add Reference Photos Storage
-- Date: 2024-12-10
-- Purpose: Store user-uploaded reference photos for avatars

-- Reference photos table
CREATE TABLE IF NOT EXISTS reference_photos (
    id SERIAL PRIMARY KEY,
    avatar_id INTEGER NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient lookup by avatar
CREATE INDEX IF NOT EXISTS idx_reference_photos_avatar ON reference_photos(avatar_id);

-- Comment for documentation
COMMENT ON TABLE reference_photos IS 'Stores reference photos uploaded by users for avatar generation';
COMMENT ON COLUMN reference_photos.image_url IS 'Base64 data URL or cloud storage URL';
