/**
 * Migration script: Move hardcoded prompts from lib/prompts.ts to pack_prompts table
 *
 * Run: pnpm tsx scripts/migrate-prompts-to-pack.ts
 *
 * This script:
 * 1. Gets or creates the 'pinglass' default pack
 * 2. Imports all 23 prompts from PHOTOSET_PROMPTS
 * 3. Sets style_prefix and style_suffix from STYLE_CONFIGS
 * 4. Updates pack preview_images
 */

import { neon } from "@neondatabase/serverless"
import { PHOTOSET_PROMPTS, STYLE_CONFIGS } from "../lib/prompts"

// Load env
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("DATABASE_URL not found in environment")
  process.exit(1)
}

const sql = neon(DATABASE_URL)

async function main() {
  console.log("Starting prompts migration to pack_prompts table...")
  console.log(`Found ${PHOTOSET_PROMPTS.length} prompts to migrate`)

  try {
    // 1. Get or verify the pinglass pack exists
    const existingPack = await sql`
      SELECT id, name, slug FROM photo_packs WHERE slug = 'pinglass'
    `

    let packId: number

    if (existingPack.length === 0) {
      // Create the pack if migration 047 wasn't run yet
      console.log("Creating 'pinglass' pack...")
      const newPack = await sql`
        INSERT INTO photo_packs (
          name, slug, description, owner_type, moderation_status,
          is_active, is_featured, sort_order, icon_emoji, preview_images
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
        )
        RETURNING id
      `
      packId = newPack[0].id
      console.log(`Created pack with id: ${packId}`)
    } else {
      packId = existingPack[0].id
      console.log(`Found existing pack: ${existingPack[0].name} (id: ${packId})`)
    }

    // 2. Check if prompts already exist
    const existingPrompts = await sql`
      SELECT COUNT(*) as count FROM pack_prompts WHERE pack_id = ${packId}
    `

    if (existingPrompts[0].count > 0) {
      console.log(`Pack already has ${existingPrompts[0].count} prompts. Skipping migration.`)
      console.log("To re-run, first delete existing prompts:")
      console.log(`  DELETE FROM pack_prompts WHERE pack_id = ${packId};`)
      process.exit(0)
    }

    // 3. Get style config for prefix/suffix
    const pinglass = STYLE_CONFIGS.pinglass
    console.log(`Using style config: ${pinglass.name}`)
    console.log(`  Prefix: ${pinglass.promptPrefix.substring(0, 50)}...`)
    console.log(`  Suffix: ${pinglass.promptSuffix.substring(0, 50)}...`)

    // 4. Insert all prompts
    console.log("\nInserting prompts...")

    for (let i = 0; i < PHOTOSET_PROMPTS.length; i++) {
      const prompt = PHOTOSET_PROMPTS[i]

      await sql`
        INSERT INTO pack_prompts (
          pack_id,
          prompt,
          style_prefix,
          style_suffix,
          position,
          is_active
        ) VALUES (
          ${packId},
          ${prompt},
          ${pinglass.promptPrefix},
          ${pinglass.promptSuffix},
          ${i},
          TRUE
        )
      `

      // Log first 60 chars of each prompt for verification
      const promptPreview = prompt.substring(0, 60).replace(/\n/g, " ")
      console.log(`  [${i + 1}/23] ${promptPreview}...`)
    }

    // 5. Verify migration
    const finalCount = await sql`
      SELECT COUNT(*) as count FROM pack_prompts WHERE pack_id = ${packId}
    `

    console.log(`\n✅ Migration complete!`)
    console.log(`   Pack: pinglass (id: ${packId})`)
    console.log(`   Prompts migrated: ${finalCount[0].count}`)

    // 6. Show sample query
    console.log("\nTo verify, run:")
    console.log(`  SELECT id, position, LEFT(prompt, 50) FROM pack_prompts WHERE pack_id = ${packId} ORDER BY position;`)

  } catch (error) {
    console.error("Migration failed:", error)
    process.exit(1)
  }
}

main()
