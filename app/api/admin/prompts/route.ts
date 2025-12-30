/**
 * GET/POST /api/admin/prompts
 * Saved prompts management
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const styleId = searchParams.get('style_id')
    const favorite = searchParams.get('favorite')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const offset = (page - 1) * limit

    const sql = getSql()

    // Build filters
    let whereClause = 'WHERE 1=1'
    if (styleId) {
      whereClause += ` AND style_id = '${styleId}'`
    }
    if (favorite === 'true') {
      whereClause += ' AND is_favorite = true'
    }

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total FROM saved_prompts
    `
    const total = parseInt(countResult[0]?.total || '0', 10)

    // Get prompts
    const prompts = await sql`
      SELECT
        sp.id,
        sp.admin_id,
        sp.name,
        sp.prompt,
        sp.negative_prompt,
        sp.style_id,
        sp.preview_url,
        sp.is_favorite,
        sp.tags,
        sp.created_at,
        sp.updated_at,
        au.email as admin_email
      FROM saved_prompts sp
      LEFT JOIN admin_users au ON au.id = sp.admin_id
      ORDER BY sp.is_favorite DESC, sp.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `

    return NextResponse.json({
      prompts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('[Admin Prompts] GET Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, prompt, negative_prompt, style_id, preview_url, is_favorite, tags } = body

    if (!name || !prompt) {
      return NextResponse.json(
        { error: 'Name and prompt are required' },
        { status: 400 }
      )
    }

    const sql = getSql()

    const [newPrompt] = await sql`
      INSERT INTO saved_prompts (
        admin_id,
        name,
        prompt,
        negative_prompt,
        style_id,
        preview_url,
        is_favorite,
        tags
      ) VALUES (
        ${session.adminId},
        ${name},
        ${prompt},
        ${negative_prompt || null},
        ${style_id || null},
        ${preview_url || null},
        ${is_favorite || false},
        ${tags || null}
      )
      RETURNING *
    `

    return NextResponse.json({ prompt: newPrompt }, { status: 201 })
  } catch (error) {
    console.error('[Admin Prompts] POST Error:', error)
    return NextResponse.json(
      { error: 'Failed to create prompt' },
      { status: 500 }
    )
  }
}
