/**
 * Migration script: Copy external preview URLs to R2
 * 
 * This script finds all pack_prompts with external preview URLs
 * (not already in R2) and copies them to our R2 bucket.
 * 
 * Run with: npx tsx scripts/migrate-pack-previews-to-r2.ts
 * 
 * Safe to run multiple times - skips already migrated URLs.
 */

import { neon } from '@neondatabase/serverless'
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3"
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// ============================================================================
// Configuration
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID?.trim()
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID?.trim()
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY?.trim()
const R2_BUCKET_NAME = (process.env.R2_BUCKET_NAME || "pinglass").trim()
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.trim()

// ============================================================================
// Helpers
// ============================================================================

function isExternalUrl(url: string | null): boolean {
  if (!url) return false
  if (url.includes('.r2.dev')) return false
  if (url.includes('r2.cloudflarestorage.com')) return false
  if (url.includes('pub-8c1af6d8a8944be49e5e168a1b0f03c8')) return false
  return url.startsWith('http')
}

function generatePreviewKey(packId: number, promptId: number): string {
  const timestamp = Date.now()
  return `previews/pack-${packId}/prompt-${promptId}-${timestamp}.jpg`
}

function getPublicUrl(key: string): string {
  if (R2_PUBLIC_URL) {
    const baseUrl = R2_PUBLIC_URL.replace(/\/$/, "")
    return `${baseUrl}/${key}`
  }
  return `https://pub-8c1af6d8a8944be49e5e168a1b0f03c8.r2.dev/${key}`
}

// ============================================================================
// Main Migration
// ============================================================================

async function main() {
  console.log('🔄 Pack Preview Migration to R2\n')

  // Validate configuration
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set in .env.local')
    process.exit(1)
  }

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error('❌ R2 configuration missing. Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY')
    console.log('\nThis script requires R2 credentials. You can:')
    console.log('1. Add R2_* variables to .env.local')
    console.log('2. Or run this script on Vercel where env vars are configured')
    process.exit(1)
  }

  const sql = neon(DATABASE_URL)
  const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })

  // Find all prompts with external preview URLs
  console.log('🔍 Finding prompts with external preview URLs...\n')

  const prompts = await sql`
    SELECT 
      pp.id,
      pp.pack_id,
      pp.prompt,
      pp.preview_url,
      p.name as pack_name
    FROM pack_prompts pp
    JOIN photo_packs p ON p.id = pp.pack_id
    WHERE pp.preview_url IS NOT NULL
      AND pp.preview_url != ''
    ORDER BY pp.pack_id, pp.id
  `

  const externalPrompts = prompts.filter(p => isExternalUrl(p.preview_url as string))

  console.log(`Found ${prompts.length} total prompts with preview URLs`)
  console.log(`Found ${externalPrompts.length} prompts with EXTERNAL URLs (need migration)\n`)

  if (externalPrompts.length === 0) {
    console.log('✅ Nothing to migrate - all previews are already in R2!')
    return
  }

  // Process each external URL
  let successCount = 0
  let errorCount = 0

  for (const prompt of externalPrompts) {
    const { id, pack_id, preview_url, pack_name } = prompt as {
      id: number
      pack_id: number
      preview_url: string
      pack_name: string
    }

    console.log(`[${pack_name}] Prompt #${id}:`)
    console.log(`  Source: ${preview_url.substring(0, 60)}...`)

    try {
      // Download image
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout
      
      const response = await fetch(preview_url, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const contentType = response.headers.get("content-type") || "image/jpeg"

      // Upload to R2
      const key = generatePreviewKey(pack_id, id)
      
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }))

      const newUrl = getPublicUrl(key)

      // Update database
      await sql`
        UPDATE pack_prompts
        SET preview_url = ${newUrl}
        WHERE id = ${id}
      `

      console.log(`  ✅ Migrated to: ${newUrl}`)
      successCount++
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      errorCount++
    }
  }

  // Update pack preview_images arrays
  console.log('\n📦 Updating pack preview_images...')

  const affectedPacks = [...new Set(externalPrompts.map(p => p.pack_id))]
  
  for (const packId of affectedPacks) {
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

    const previewUrls = (previews as Array<{ preview_url: string }>).map(p => p.preview_url)

    await sql`
      UPDATE photo_packs
      SET
        preview_images = ${previewUrls},
        updated_at = NOW()
      WHERE id = ${packId}
    `

    console.log(`  Pack #${packId}: Updated with ${previewUrls.length} preview images`)
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 Migration Summary:')
  console.log(`  ✅ Successfully migrated: ${successCount}`)
  console.log(`  ❌ Errors: ${errorCount}`)
  console.log('='.repeat(50))

  if (errorCount > 0) {
    console.log('\n⚠️  Some images failed to migrate. They may:')
    console.log('  - Be expired/deleted from the source')
    console.log('  - Require authentication')
    console.log('  - Have network issues')
    console.log('\nYou can re-run this script safely - it will skip already migrated URLs.')
  }
}

main().catch((error) => {
  console.error('❌ Migration failed:', error)
  process.exit(1)
})
