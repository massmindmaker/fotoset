/**
 * Helper functions for photo pack management
 */

import { neon } from '@neondatabase/serverless'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

/**
 * Update photo_packs.preview_images from pack_prompts preview URLs
 * Collects first 4 non-null preview_url values from pack_prompts
 */
export async function updatePackPreviewImages(packId: number): Promise<void> {
  const sql = getSql()

  // Get first 4 preview URLs from pack_prompts
  const previews = await sql`
    SELECT preview_url
    FROM pack_prompts
    WHERE pack_id = ${packId}
      AND is_active = TRUE
      AND preview_url IS NOT NULL
      AND preview_url != ''
    ORDER BY position ASC, id ASC
    LIMIT 4
  `

  const previewUrls = previews.map((p) => (p as { preview_url: string }).preview_url)

  // Update pack with collected preview images
  await sql`
    UPDATE photo_packs
    SET
      preview_images = ${previewUrls},
      updated_at = NOW()
    WHERE id = ${packId}
  `

  console.log(`[Pack Helpers] Updated pack ${packId} with ${previewUrls.length} preview images`)
}

/**
 * Get next position for a prompt in a pack
 */
export async function getNextPromptPosition(packId: number): Promise<number> {
  const sql = getSql()

  const result = await sql`
    SELECT COALESCE(MAX(position), 0) + 1 as next_position
    FROM pack_prompts
    WHERE pack_id = ${packId}
  `

  return result[0]?.next_position || 1
}

/**
 * Add a saved prompt to a pack
 * Copies prompt data and importantly transfers preview_url
 */
export async function addSavedPromptToPack(
  packId: number,
  savedPromptId: number
): Promise<{ id: number; previewUrl: string | null }> {
  const sql = getSql()

  // Get saved prompt data
  const savedPrompt = await sql`
    SELECT
      prompt,
      negative_prompt,
      style_id,
      preview_url
    FROM saved_prompts
    WHERE id = ${savedPromptId}
  `

  if (savedPrompt.length === 0) {
    throw new Error('Saved prompt not found')
  }

  const sp = savedPrompt[0]
  const position = await getNextPromptPosition(packId)

  // Insert into pack_prompts with preview_url transferred
  const result = await sql`
    INSERT INTO pack_prompts (
      pack_id,
      prompt,
      negative_prompt,
      preview_url,
      position,
      is_active
    ) VALUES (
      ${packId},
      ${sp.prompt},
      ${sp.negative_prompt || null},
      ${sp.preview_url || null},
      ${position},
      TRUE
    )
    RETURNING id, preview_url
  `

  const newPrompt = result[0]

  // Auto-update pack preview images if we added a prompt with preview
  if (sp.preview_url) {
    await updatePackPreviewImages(packId)
  }

  return {
    id: newPrompt.id,
    previewUrl: newPrompt.preview_url
  }
}
