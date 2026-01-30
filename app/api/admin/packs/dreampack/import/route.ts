export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
import { DREAMPACK, allDreampackPrompts } from '@/data/packs/dreampack'
/**
 * POST /api/admin/packs/dreampack/import
 * Imports all DREAM PACK prompts into the database
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' } },
        { status: 401 }
      )
    }
    // Check if DREAM PACK already exists
    const existingPack = await sql`
      SELECT id FROM photo_packs WHERE name = ${DREAMPACK.nameRU}
    `

    let packId: number

    if (existingPack.length > 0) {
      // Pack exists, use it
      packId = existingPack[0].id
      console.log('[DreampackImport] Using existing pack:', packId)
    } else {
      // Create the pack
      const [newPack] = await sql`
        INSERT INTO photo_packs (admin_id, name, description, is_active)
        VALUES (${session.adminId}, ${DREAMPACK.nameRU}, ${DREAMPACK.description}, true)
        RETURNING id
      `
      packId = newPack.id
      console.log('[DreampackImport] Created new pack:', packId)
    }

    // Import prompts
    let imported = 0
    let skipped = 0

    for (const prompt of allDreampackPrompts) {
      // Check if prompt already exists
      const existing = await sql`
        SELECT id FROM saved_prompts
        WHERE name = ${`${prompt.nameRU} ${prompt.version}`}
        AND admin_id = ${session.adminId}
      `

      if (existing.length > 0) {
        skipped++
        continue
      }

      // Insert new prompt
      // Convert tags array to PostgreSQL array format
      const tagsArray = prompt.tags && prompt.tags.length > 0 ? prompt.tags : null
      const [savedPrompt] = await sql`
        INSERT INTO saved_prompts (
          admin_id,
          name,
          prompt,
          negative_prompt,
          style_id,
          is_favorite,
          tags
        )
        VALUES (
          ${session.adminId},
          ${`${prompt.nameRU} ${prompt.version}`},
          ${prompt.prompt},
          ${prompt.negativePrompt || null},
          ${'dreampack'},
          ${false},
          ${tagsArray}
        )
        RETURNING id
      `

      // Link prompt to pack
      await sql`
        INSERT INTO pack_items (pack_id, prompt_id, display_order)
        VALUES (${packId}, ${savedPrompt.id}, ${imported})
        ON CONFLICT DO NOTHING
      `

      imported++
    }

    return NextResponse.json({
      success: true,
      packId,
      packName: DREAMPACK.nameRU,
      imported,
      skipped,
      total: allDreampackPrompts.length,
    })
  } catch (error) {
    console.error('[DreampackImport] Error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'IMPORT_ERROR',
          message: error instanceof Error ? error.message : 'Ошибка импорта'
        }
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/packs/dreampack/import
 * Returns DREAM PACK preview (without importing)
 */
export async function GET() {
  return NextResponse.json({
    pack: {
      id: DREAMPACK.id,
      nameRU: DREAMPACK.nameRU,
      nameEN: DREAMPACK.nameEN,
      description: DREAMPACK.description,
      version: DREAMPACK.version,
      totalPrompts: DREAMPACK.totalPrompts,
      baseScenes: DREAMPACK.baseScenes,
      withV2Variants: DREAMPACK.withV2Variants,
      categories: DREAMPACK.categories,
    },
    prompts: allDreampackPrompts.map(p => ({
      id: p.id,
      nameRU: p.nameRU,
      nameEN: p.nameEN,
      version: p.version,
      category: p.category,
      tags: p.tags,
      promptPreview: p.prompt.slice(0, 100) + '...',
    })),
  })
}
