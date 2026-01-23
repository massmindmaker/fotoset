/**
 * Migration script: Copy saved_prompts (style_id='pinglass') to pack_prompts with preview_url
 *
 * Run with: node scripts/migrate-pack-prompts-with-previews.mjs
 */

import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env.local' })

const PINGLASS_PACK_ID = 1
const PINGLASS_STYLE_ID = 'pinglass'

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL not set in .env.local')
    process.exit(1)
  }

  const sql = neon(databaseUrl)

  console.log('='.repeat(60))
  console.log('Migration: saved_prompts -> pack_prompts with preview_url')
  console.log('='.repeat(60))

  // Step 1: Check current state
  console.log('\n1. Checking current state...')

  const savedPrompts = await sql`
    SELECT id, name, prompt, negative_prompt, preview_url, style_id
    FROM saved_prompts
    WHERE style_id = ${PINGLASS_STYLE_ID}
      AND preview_url IS NOT NULL
      AND preview_url != ''
    ORDER BY id
  `
  console.log(`   Found ${savedPrompts.length} saved_prompts with style_id='${PINGLASS_STYLE_ID}' and preview_url`)

  const existingPackPrompts = await sql`
    SELECT COUNT(*) as count
    FROM pack_prompts
    WHERE pack_id = ${PINGLASS_PACK_ID}
  `
  console.log(`   Existing pack_prompts for pack #${PINGLASS_PACK_ID}: ${existingPackPrompts[0].count}`)

  if (savedPrompts.length === 0) {
    console.log('\n   No saved_prompts with preview_url found. Nothing to migrate.')
    process.exit(0)
  }

  // Step 2: Show what we'll migrate
  console.log('\n2. Preview of prompts to migrate:')
  for (const sp of savedPrompts.slice(0, 5)) {
    console.log(`   [${sp.id}] ${sp.name}`)
    console.log(`      Preview: ${sp.preview_url?.substring(0, 60)}...`)
  }
  if (savedPrompts.length > 5) {
    console.log(`   ... and ${savedPrompts.length - 5} more`)
  }

  // Step 3: Delete existing pack_prompts for pack #1
  console.log(`\n3. Deleting existing pack_prompts for pack #${PINGLASS_PACK_ID}...`)
  const deleted = await sql`
    DELETE FROM pack_prompts
    WHERE pack_id = ${PINGLASS_PACK_ID}
    RETURNING id
  `
  console.log(`   Deleted ${deleted.length} existing pack_prompts`)

  // Step 4: Insert new pack_prompts from saved_prompts
  console.log('\n4. Inserting new pack_prompts with preview_url...')
  let insertedCount = 0

  for (let i = 0; i < savedPrompts.length; i++) {
    const sp = savedPrompts[i]

    await sql`
      INSERT INTO pack_prompts (
        pack_id,
        prompt,
        negative_prompt,
        preview_url,
        position,
        is_active,
        created_at
      ) VALUES (
        ${PINGLASS_PACK_ID},
        ${sp.prompt},
        ${sp.negative_prompt || ''},
        ${sp.preview_url},
        ${i},
        TRUE,
        NOW()
      )
    `
    insertedCount++
  }
  console.log(`   Inserted ${insertedCount} new pack_prompts`)

  // Step 5: Update photo_packs.preview_images
  console.log('\n5. Updating photo_packs.preview_images...')

  const firstFourPreviews = await sql`
    SELECT preview_url
    FROM pack_prompts
    WHERE pack_id = ${PINGLASS_PACK_ID}
      AND is_active = TRUE
      AND preview_url IS NOT NULL
      AND preview_url != ''
    ORDER BY position ASC
    LIMIT 4
  `

  const previewUrls = firstFourPreviews.map(p => p.preview_url)

  if (previewUrls.length > 0) {
    await sql`
      UPDATE photo_packs
      SET
        preview_images = ${previewUrls},
        updated_at = NOW()
      WHERE id = ${PINGLASS_PACK_ID}
    `
    console.log(`   Updated preview_images with ${previewUrls.length} URLs`)
  } else {
    console.log('   No preview URLs available for photo_packs.preview_images')
  }

  // Step 6: Verify
  console.log('\n6. Verification:')

  const finalPackPrompts = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(preview_url) FILTER (WHERE preview_url IS NOT NULL AND preview_url != '') as with_preview
    FROM pack_prompts
    WHERE pack_id = ${PINGLASS_PACK_ID}
  `
  console.log(`   Total pack_prompts: ${finalPackPrompts[0].total}`)
  console.log(`   With preview_url: ${finalPackPrompts[0].with_preview}`)

  const finalPack = await sql`
    SELECT id, name, preview_images
    FROM photo_packs
    WHERE id = ${PINGLASS_PACK_ID}
  `
  if (finalPack.length > 0) {
    const pack = finalPack[0]
    const previewCount = Array.isArray(pack.preview_images) ? pack.preview_images.length : 0
    console.log(`   Pack [${pack.id}] ${pack.name}: ${previewCount} preview images in array`)
    if (previewCount > 0) {
      console.log(`   First preview: ${pack.preview_images[0]}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('Migration complete!')
  console.log('='.repeat(60))
}

main().catch((error) => {
  console.error('\n Error:', error)
  process.exit(1)
})
