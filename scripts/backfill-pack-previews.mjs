/**
 * Backfill script: Update photo_packs.preview_images from pack_prompts
 * Run with: node scripts/backfill-pack-previews.mjs
 */

import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env.local' })

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL not set in .env.local')
    process.exit(1)
  }

  const sql = neon(databaseUrl)

  console.log('🔍 Checking current state of photo_packs...\n')

  // Get all packs with their current preview state
  const packs = await sql`
    SELECT
      p.id,
      p.name,
      p.preview_images,
      (
        SELECT COUNT(*)
        FROM pack_prompts pp
        WHERE pp.pack_id = p.id AND pp.is_active = TRUE
      ) as prompt_count,
      (
        SELECT COUNT(*)
        FROM pack_prompts pp
        WHERE pp.pack_id = p.id
          AND pp.is_active = TRUE
          AND pp.preview_url IS NOT NULL
          AND pp.preview_url != ''
      ) as prompts_with_preview
    FROM photo_packs p
    ORDER BY p.id
  `

  console.log('Current packs state:')
  for (const pack of packs) {
    const previewCount = Array.isArray(pack.preview_images) ? pack.preview_images.length : 0
    console.log(`  [${pack.id}] ${pack.name}`)
    console.log(`      - Current preview_images: ${previewCount}`)
    console.log(`      - Total prompts: ${pack.prompt_count}`)
    console.log(`      - Prompts with preview_url: ${pack.prompts_with_preview}`)
  }

  console.log('\n📝 Running backfill...\n')

  // Update each pack with preview images from pack_prompts
  for (const pack of packs) {
    // Get first 4 preview URLs from pack_prompts
    const previews = await sql`
      SELECT preview_url
      FROM pack_prompts
      WHERE pack_id = ${pack.id}
        AND is_active = TRUE
        AND preview_url IS NOT NULL
        AND preview_url != ''
      ORDER BY position ASC, id ASC
      LIMIT 4
    `

    const previewUrls = previews.map(p => p.preview_url)

    if (previewUrls.length > 0) {
      await sql`
        UPDATE photo_packs
        SET
          preview_images = ${previewUrls},
          updated_at = NOW()
        WHERE id = ${pack.id}
      `
      console.log(`✅ Pack [${pack.id}] ${pack.name}: Updated with ${previewUrls.length} preview images`)
    } else {
      console.log(`⏭️  Pack [${pack.id}] ${pack.name}: No preview URLs available in prompts`)
    }
  }

  console.log('\n✨ Backfill complete!')

  // Verify results
  const verifyPacks = await sql`
    SELECT id, name, preview_images
    FROM photo_packs
    ORDER BY id
  `

  console.log('\n📊 Final state:')
  for (const pack of verifyPacks) {
    const previewCount = Array.isArray(pack.preview_images) ? pack.preview_images.length : 0
    console.log(`  [${pack.id}] ${pack.name}: ${previewCount} preview images`)
  }
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
