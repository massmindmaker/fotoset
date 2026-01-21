#!/usr/bin/env node
/**
 * Run migration 047 for Dynamic Packs System
 * Executes against Neon PostgreSQL using @neondatabase/serverless
 */

import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

// Load .env.local
config({ path: '.env.local' })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

async function runMigration() {
  console.log('🚀 Running Migration 047: Dynamic Packs System')
  console.log('=' .repeat(60))

  try {
    // PART 1: Extend photo_packs table
    console.log('\n📦 PART 1: Extending photo_packs table...')

    await sql`ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS owner_type VARCHAR(20) DEFAULT 'admin'`
    console.log('  ✓ owner_type')

    await sql`ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS partner_user_id INTEGER REFERENCES users(id)`
    console.log('  ✓ partner_user_id')

    await sql`ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'approved'`
    console.log('  ✓ moderation_status')

    await sql`ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP`
    console.log('  ✓ submitted_at')

    await sql`ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES admin_users(id)`
    console.log('  ✓ reviewed_by')

    await sql`ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP`
    console.log('  ✓ reviewed_at')

    await sql`ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS rejection_reason TEXT`
    console.log('  ✓ rejection_reason')

    await sql`ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS slug VARCHAR(100)`
    console.log('  ✓ slug')

    await sql`ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS preview_images TEXT[]`
    console.log('  ✓ preview_images')

    await sql`ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS icon_emoji VARCHAR(10) DEFAULT '🎨'`
    console.log('  ✓ icon_emoji')

    await sql`ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 100`
    console.log('  ✓ sort_order')

    await sql`ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE`
    console.log('  ✓ is_featured')

    await sql`ALTER TABLE photo_packs ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0`
    console.log('  ✓ usage_count')

    // Add unique constraint on slug (if not exists - wrapped in try/catch)
    try {
      await sql`ALTER TABLE photo_packs ADD CONSTRAINT photo_packs_slug_key UNIQUE (slug)`
      console.log('  ✓ slug unique constraint')
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('  ⏭ slug unique constraint already exists')
      } else {
        throw e
      }
    }

    // Add check constraints (wrapped in try/catch)
    try {
      await sql`ALTER TABLE photo_packs ADD CONSTRAINT photo_packs_owner_type_check CHECK (owner_type IN ('admin', 'partner'))`
      console.log('  ✓ owner_type check constraint')
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('  ⏭ owner_type check constraint already exists')
      } else {
        throw e
      }
    }

    try {
      await sql`ALTER TABLE photo_packs ADD CONSTRAINT photo_packs_moderation_status_check CHECK (moderation_status IN ('draft', 'pending', 'approved', 'rejected'))`
      console.log('  ✓ moderation_status check constraint')
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('  ⏭ moderation_status check constraint already exists')
      } else {
        throw e
      }
    }

    // Create indexes
    console.log('\n📇 Creating indexes for photo_packs...')
    await sql`CREATE INDEX IF NOT EXISTS idx_packs_active_approved ON photo_packs(is_active, moderation_status) WHERE is_active = TRUE AND moderation_status = 'approved'`
    await sql`CREATE INDEX IF NOT EXISTS idx_packs_partner ON photo_packs(partner_user_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_packs_slug ON photo_packs(slug)`
    await sql`CREATE INDEX IF NOT EXISTS idx_packs_moderation ON photo_packs(moderation_status, submitted_at) WHERE moderation_status = 'pending'`
    await sql`CREATE INDEX IF NOT EXISTS idx_packs_sort ON photo_packs(sort_order, is_featured DESC)`
    console.log('  ✓ All indexes created')

    // PART 2: pack_prompts table
    console.log('\n📝 PART 2: Creating pack_prompts table...')
    await sql`
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
      )
    `
    console.log('  ✓ pack_prompts table created')

    await sql`CREATE INDEX IF NOT EXISTS idx_pack_prompts_pack ON pack_prompts(pack_id, position)`
    await sql`CREATE INDEX IF NOT EXISTS idx_pack_prompts_active ON pack_prompts(pack_id) WHERE is_active = TRUE`
    console.log('  ✓ pack_prompts indexes created')

    // PART 3: Link users to active pack
    console.log('\n👤 PART 3: Adding active_pack_id to users...')
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active_pack_id INTEGER REFERENCES photo_packs(id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_users_active_pack ON users(active_pack_id)`
    console.log('  ✓ users.active_pack_id added')

    // PART 4: Link generation_jobs to packs
    console.log('\n🔗 PART 4: Adding pack_id to generation_jobs...')
    await sql`ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS pack_id INTEGER REFERENCES photo_packs(id)`
    await sql`ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS used_prompt_ids INTEGER[]`
    await sql`CREATE INDEX IF NOT EXISTS idx_generation_jobs_pack ON generation_jobs(pack_id)`
    console.log('  ✓ generation_jobs columns added')

    // PART 5: Link kie_tasks to pack_prompts
    console.log('\n🔗 PART 5: Adding pack_prompt_id to kie_tasks...')
    await sql`ALTER TABLE kie_tasks ADD COLUMN IF NOT EXISTS pack_prompt_id INTEGER REFERENCES pack_prompts(id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_kie_tasks_pack_prompt ON kie_tasks(pack_prompt_id)`
    console.log('  ✓ kie_tasks.pack_prompt_id added')

    // PART 6: Link generated_photos to pack_prompts
    console.log('\n🔗 PART 6: Adding pack_prompt_id to generated_photos...')
    await sql`ALTER TABLE generated_photos ADD COLUMN IF NOT EXISTS pack_prompt_id INTEGER REFERENCES pack_prompts(id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_generated_photos_pack_prompt ON generated_photos(pack_prompt_id)`
    console.log('  ✓ generated_photos.pack_prompt_id added')

    // PART 7: Pack usage statistics
    console.log('\n📊 PART 7: Creating pack_usage_stats table...')
    await sql`
      CREATE TABLE IF NOT EXISTS pack_usage_stats (
        id SERIAL PRIMARY KEY,
        pack_id INTEGER NOT NULL REFERENCES photo_packs(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        generation_job_id INTEGER REFERENCES generation_jobs(id),
        photo_count INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_pack_usage_pack ON pack_usage_stats(pack_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_pack_usage_created ON pack_usage_stats(created_at DESC)`
    console.log('  ✓ pack_usage_stats table created')

    // PART 8: Create default PinGlass pack
    console.log('\n🌸 PART 8: Creating default PinGlass pack...')

    // Check if pack with slug 'pinglass' exists
    const existingPack = await sql`SELECT id FROM photo_packs WHERE slug = 'pinglass'`

    if (existingPack.length === 0) {
      // Check if any pack exists
      const anyPack = await sql`SELECT id FROM photo_packs LIMIT 1`

      if (anyPack.length > 0) {
        // Update existing pack to be PinGlass
        await sql`
          UPDATE photo_packs
          SET
            slug = 'pinglass',
            name = 'PinGlass Premium',
            description = 'AI-фотографии премиум качества в стиле Vogue/GQ/Elle. 23 уникальных образа от профессионального до креативного.',
            owner_type = 'admin',
            moderation_status = 'approved',
            is_active = TRUE,
            is_featured = TRUE,
            sort_order = 1,
            icon_emoji = '🌸',
            preview_images = ARRAY[
              '/optimized/demo/Screenshot_1.webp',
              '/optimized/demo/Screenshot_2.webp',
              '/optimized/demo/Screenshot_3.webp',
              '/optimized/demo/Screenshot_4.webp'
            ]
          WHERE id = ${anyPack[0].id}
        `
        console.log(`  ✓ Updated existing pack (id=${anyPack[0].id}) to PinGlass Premium`)
      } else {
        // Insert new pack
        await sql`
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
        `
        console.log('  ✓ Created new PinGlass Premium pack')
      }
    } else {
      console.log(`  ⏭ PinGlass pack already exists (id=${existingPack[0].id})`)
    }

    // Verify migration
    console.log('\n✅ VERIFICATION:')
    const columns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'photo_packs'
      ORDER BY ordinal_position
    `
    console.log('  photo_packs columns:', columns.map(c => c.column_name).join(', '))

    const packPromptsCols = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'pack_prompts'
      ORDER BY ordinal_position
    `
    console.log('  pack_prompts columns:', packPromptsCols.map(c => c.column_name).join(', '))

    const pinglass = await sql`SELECT id, slug, name FROM photo_packs WHERE slug = 'pinglass'`
    if (pinglass.length > 0) {
      console.log(`  PinGlass pack: id=${pinglass[0].id}, name="${pinglass[0].name}"`)
    }

    console.log('\n' + '=' .repeat(60))
    console.log('🎉 Migration 047 completed successfully!')

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message)
    console.error(error)
    process.exit(1)
  }
}

runMigration()
