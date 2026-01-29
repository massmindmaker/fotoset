/**
 * GET/POST /api/admin/packs
 * Photo packs management
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const offset = (page - 1) * limit
    // Get total count
    const countResult = activeOnly
      ? await sql`SELECT COUNT(*) as total FROM photo_packs WHERE is_active = true`
      : await sql`SELECT COUNT(*) as total FROM photo_packs`
    const total = parseInt(countResult[0]?.total || '0', 10)

    // Get packs with item counts
    const packs = activeOnly
      ? await sql`
          SELECT
            pp.id,
            pp.admin_id,
            pp.name,
            pp.description,
            pp.cover_url,
            pp.is_active,
            pp.created_at,
            pp.updated_at,
            au.email as admin_email,
            COUNT(pi.id) as items_count
          FROM photo_packs pp
          LEFT JOIN admin_users au ON au.id = pp.admin_id
          LEFT JOIN pack_items pi ON pi.pack_id = pp.id
          WHERE pp.is_active = true
          GROUP BY pp.id, au.email
          ORDER BY pp.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `
      : await sql`
          SELECT
            pp.id,
            pp.admin_id,
            pp.name,
            pp.description,
            pp.cover_url,
            pp.is_active,
            pp.created_at,
            pp.updated_at,
            au.email as admin_email,
            COUNT(pi.id) as items_count
          FROM photo_packs pp
          LEFT JOIN admin_users au ON au.id = pp.admin_id
          LEFT JOIN pack_items pi ON pi.pack_id = pp.id
          GROUP BY pp.id, au.email
          ORDER BY pp.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `

    return NextResponse.json({
      packs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('[Admin Packs] GET Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch packs' },
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
    const { name, description, cover_url, is_active } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }
    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    const [newPack] = await sql`
      INSERT INTO photo_packs (
        admin_id,
        name,
        slug,
        description,
        cover_url,
        is_active,
        moderation_status,
        owner_type
      ) VALUES (
        ${session.adminId},
        ${name},
        ${slug},
        ${description || null},
        ${cover_url || null},
        ${is_active !== false},
        'approved',
        'admin'
      )
      RETURNING *
    `

    return NextResponse.json({ pack: newPack }, { status: 201 })
  } catch (error) {
    console.error('[Admin Packs] POST Error:', error)
    return NextResponse.json(
      { error: 'Failed to create pack' },
      { status: 500 }
    )
  }
}
