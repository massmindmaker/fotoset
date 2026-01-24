/**
 * POST /api/admin/packs/[id]/items
 * Add saved_prompt to pack_prompts with preview_url transfer
 *
 * DELETE /api/admin/packs/[id]/items
 * Remove prompt from pack
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'
import { addSavedPromptToPack, updatePackPreviewImages } from '@/lib/pack-helpers'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST: Add saved prompt to pack
 * Body: { savedPromptId: number }
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const packId = parseInt(id, 10)

    if (isNaN(packId)) {
      return NextResponse.json(
        { error: 'Invalid pack ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { savedPromptId } = body

    if (!savedPromptId || typeof savedPromptId !== 'number') {
      return NextResponse.json(
        { error: 'savedPromptId is required and must be a number' },
        { status: 400 }
      )
    }

    // Verify pack exists
    const sql = getSql()
    const packCheck = await sql`
      SELECT id FROM photo_packs WHERE id = ${packId}
    `

    if (packCheck.length === 0) {
      return NextResponse.json(
        { error: 'Pack not found' },
        { status: 404 }
      )
    }

    // Add prompt to pack
    const result = await addSavedPromptToPack(packId, savedPromptId)

    return NextResponse.json({
      success: true,
      packPromptId: result.id,
      previewUrl: result.previewUrl,
      message: 'Prompt added to pack successfully'
    })
  } catch (error) {
    console.error('[Admin Pack Items] POST Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add prompt to pack'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Remove prompt from pack
 * Body: { packPromptId: number }
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const packId = parseInt(id, 10)

    if (isNaN(packId)) {
      return NextResponse.json(
        { error: 'Invalid pack ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { packPromptId } = body

    if (!packPromptId || typeof packPromptId !== 'number') {
      return NextResponse.json(
        { error: 'packPromptId is required and must be a number' },
        { status: 400 }
      )
    }

    const sql = getSql()

    // Delete prompt from pack
    const result = await sql`
      DELETE FROM pack_prompts
      WHERE id = ${packPromptId}
        AND pack_id = ${packId}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Prompt not found in pack' },
        { status: 404 }
      )
    }

    // Update pack preview images after deletion
    await updatePackPreviewImages(packId)

    return NextResponse.json({
      success: true,
      message: 'Prompt removed from pack'
    })
  } catch (error) {
    console.error('[Admin Pack Items] DELETE Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove prompt from pack'
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH: Reorder prompts in pack
 * Body: { promptIds: number[] } - ordered list of pack_prompt IDs
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const packId = parseInt(id, 10)

    if (isNaN(packId)) {
      return NextResponse.json(
        { error: 'Invalid pack ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { promptIds } = body

    if (!Array.isArray(promptIds) || promptIds.length === 0) {
      return NextResponse.json(
        { error: 'promptIds must be a non-empty array' },
        { status: 400 }
      )
    }

    const sql = getSql()

    // Update positions for each prompt
    for (let i = 0; i < promptIds.length; i++) {
      await sql`
        UPDATE pack_prompts
        SET position = ${i + 1}
        WHERE id = ${promptIds[i]}
          AND pack_id = ${packId}
      `
    }

    // Update preview images (first 4 by new order)
    await updatePackPreviewImages(packId)

    return NextResponse.json({
      success: true,
      message: 'Prompts reordered successfully'
    })
  } catch (error) {
    console.error('[Admin Pack Items] PATCH Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reorder prompts'
      },
      { status: 500 }
    )
  }
}
