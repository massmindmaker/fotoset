/**
 * GET/PUT/DELETE /api/admin/prompts/[promptId]
 * Single prompt management
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ promptId: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { promptId } = await context.params
    const id = parseInt(promptId, 10)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid prompt ID' }, { status: 400 })
    }
    const [prompt] = await sql`
      SELECT
        sp.*,
        au.email as admin_email
      FROM saved_prompts sp
      LEFT JOIN admin_users au ON au.id = sp.admin_id
      WHERE sp.id = ${id}
    `

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }

    return NextResponse.json({ prompt })
  } catch (error) {
    console.error('[Admin Prompts] GET Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompt' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ promptId: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { promptId } = await context.params
    const id = parseInt(promptId, 10)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid prompt ID' }, { status: 400 })
    }

    const body = await request.json()
    const { name, prompt, negative_prompt, style_id, preview_url, is_favorite, tags } = body
    const [updated] = await sql`
      UPDATE saved_prompts SET
        name = COALESCE(${name}, name),
        prompt = COALESCE(${prompt}, prompt),
        negative_prompt = ${negative_prompt},
        style_id = ${style_id},
        preview_url = ${preview_url},
        is_favorite = COALESCE(${is_favorite}, is_favorite),
        tags = ${tags},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (!updated) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }

    return NextResponse.json({ prompt: updated })
  } catch (error) {
    console.error('[Admin Prompts] PUT Error:', error)
    return NextResponse.json(
      { error: 'Failed to update prompt' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ promptId: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { promptId } = await context.params
    const id = parseInt(promptId, 10)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid prompt ID' }, { status: 400 })
    }
    const [deleted] = await sql`
      DELETE FROM saved_prompts
      WHERE id = ${id}
      RETURNING id
    `

    if (!deleted) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin Prompts] DELETE Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete prompt' },
      { status: 500 }
    )
  }
}
