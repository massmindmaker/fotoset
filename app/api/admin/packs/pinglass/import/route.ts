import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
import { PINGLASS, allPinGlassPrompts } from '@/data/packs/pinglass'
/**
 * POST /api/admin/packs/pinglass/import
 * Imports all PinGlass prompts into the database
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
    // Check if PinGlass pack already exists
    const existingPack = await sql`
      SELECT id FROM photo_packs WHERE name = ${PINGLASS.nameRU}
    `

    let packId: number

    if (existingPack.length > 0) {
      // Pack exists, use it
      packId = existingPack[0].id
      console.log('[PinGlassImport] Using existing pack:', packId)
    } else {
      // Create the pack
      const [newPack] = await sql`
        INSERT INTO photo_packs (admin_id, name, description, is_active)
        VALUES (${session.adminId}, ${PINGLASS.nameRU}, ${PINGLASS.description}, true)
        RETURNING id
      `
      packId = newPack.id
      console.log('[PinGlassImport] Created new pack:', packId)
    }

    // Import prompts
    let imported = 0
    let skipped = 0

    for (const prompt of allPinGlassPrompts) {
      // Check if prompt already exists
      const existing = await sql`
        SELECT id FROM saved_prompts
        WHERE name = ${prompt.nameRU}
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
          ${prompt.nameRU},
          ${prompt.prompt},
          ${prompt.negativePrompt || null},
          ${'pinglass'},
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
      packName: PINGLASS.nameRU,
      imported,
      skipped,
      total: allPinGlassPrompts.length,
    })
  } catch (error) {
    console.error('[PinGlassImport] Error:', error)
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
 * GET /api/admin/packs/pinglass/import
 * Returns PinGlass pack preview (without importing)
 */
export async function GET() {
  return NextResponse.json({
    pack: {
      id: PINGLASS.id,
      nameRU: PINGLASS.nameRU,
      nameEN: PINGLASS.nameEN,
      description: PINGLASS.description,
      version: PINGLASS.version,
      totalPrompts: PINGLASS.totalPrompts,
      categories: PINGLASS.categories,
    },
    prompts: allPinGlassPrompts.map(p => ({
      id: p.id,
      nameRU: p.nameRU,
      nameEN: p.nameEN,
      category: p.category,
      tags: p.tags,
      promptPreview: p.prompt.slice(0, 100) + '...',
    })),
  })
}
