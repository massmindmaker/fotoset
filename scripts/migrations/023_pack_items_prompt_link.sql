-- Migration 023: Add prompt_id to pack_items for linking with saved_prompts
-- Created: 2026-01-01
-- Purpose: Allow pack_items to reference saved_prompts directly

-- Add prompt_id column to pack_items
ALTER TABLE pack_items ADD COLUMN IF NOT EXISTS prompt_id INTEGER REFERENCES saved_prompts(id) ON DELETE SET NULL;

-- Add display_order as alias for position (for API compatibility)
ALTER TABLE pack_items ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Create index for prompt lookups
CREATE INDEX IF NOT EXISTS idx_pack_items_prompt ON pack_items(prompt_id);

-- Make photo_url nullable (prompts don't always have photos)
ALTER TABLE pack_items ALTER COLUMN photo_url DROP NOT NULL;

COMMENT ON COLUMN pack_items.prompt_id IS 'Reference to saved_prompts for prompt-based packs';
COMMENT ON COLUMN pack_items.display_order IS 'Display order in the pack (alias for position)';
