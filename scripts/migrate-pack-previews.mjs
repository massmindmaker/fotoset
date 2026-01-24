/**
 * Migration script: Copy preview_url from saved_prompts to pack_prompts
 * Run with: node scripts/migrate-pack-previews.mjs
 *
 * This script:
 * 1. Finds pack_prompts with NULL preview_url
 * 2. Matches them to saved_prompts by prompt text
 * 3. Copies the preview_url
 * 4. Updates photo_packs.preview_images with first 4 previews
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

  console.log('🔍 Analyzing pack_prompts without preview_url...\n')

  // Get pack_prompts without preview_url
  const promptsWithoutPreview = await sql`
    SELECT pp.id, pp.prompt, pp.pack_id, p.name as pack_name
    FROM pack_prompts pp
    JOIN photo_packs p ON p.id = pp.pack_id
    WHERE pp.preview_url IS NULL OR pp.preview_url = ''
    ORDER BY pp.pack_id, pp.position
  `

  console.log(`Found ${promptsWithoutPreview.length} pack_prompts without preview_url\n`)

  if (promptsWithoutPreview.length === 0) {
    console.log('✅ All pack_prompts already have preview_url')
    return
  }

  // Get all saved_prompts with preview_url for matching
  const savedPrompts = await sql`
    SELECT id, prompt, preview_url
    FROM saved_prompts
    WHERE preview_url IS NOT NULL AND preview_url != ''
  `

  console.log(`Found ${savedPrompts.length} saved_prompts with preview_url to match against\n`)

  // Create a map for faster lookup (use first 200 chars for matching)
  const promptMap = new Map()
  for (const sp of savedPrompts) {
    const key = sp.prompt?.trim().toLowerCase().substring(0, 200) || ''
    if (key) {
      promptMap.set(key, sp.preview_url)
    }
  }

  let updatedCount = 0
  let notFoundCount = 0

  console.log('📝 Migrating preview URLs...\n')

  for (const pp of promptsWithoutPreview) {
    const key = pp.prompt?.trim().toLowerCase().substring(0, 200) || ''
    const previewUrl = promptMap.get(key)

    if (previewUrl) {
      await sql`
        UPDATE pack_prompts
        SET preview_url = ${previewUrl}
        WHERE id = ${pp.id}
      `
      console.log(`✅ [${pp.pack_name}] Prompt #${pp.id}: Updated`)
      updatedCount++
    } else {
      console.log(`⏭️  [${pp.pack_name}] Prompt #${pp.id}: No match found`)
      notFoundCount++
    }
  }

  console.log(`\n📊 Migration results:`)
  console.log(`   Updated: ${updatedCount}`)
  console.log(`   Not found: ${notFoundCount}`)

  // Now update photo_packs.preview_images
  console.log('\n📷 Updating photo_packs.preview_images...\n')

  const packs = await sql`
    SELECT id, name FROM photo_packs ORDER BY id
  `

  for (const pack of packs) {
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
      console.log(`✅ Pack [${pack.id}] ${pack.name}: ${previewUrls.length} preview images`)
    } else {
      console.log(`⏭️  Pack [${pack.id}] ${pack.name}: No previews available`)
    }
  }

  console.log('\n✨ Migration complete!')
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
