/**
 * GET/PUT/DELETE /api/admin/packs/[packId]
 * Single photo pack management
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ packId: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { packId } = await context.params
    const id = parseInt(packId, 10)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid pack ID' }, { status: 400 })
    }

    const sql = getSql()

    // Get pack with admin info
    const [pack] = await sql`
      SELECT
        pp.*,
        au.email as admin_email,
        COUNT(pi.id) as items_count
      FROM photo_packs pp
      LEFT JOIN admin_users au ON au.id = pp.admin_id
      LEFT JOIN pack_items pi ON pi.pack_id = pp.id
      WHERE pp.id = ${id}
      GROUP BY pp.id, au.email
    `

    if (!pack) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
    }

    // Get pack items
    const items = await sql`
      SELECT *
      FROM pack_items
      WHERE pack_id = ${id}
      ORDER BY position ASC, created_at ASC
    `

    return NextResponse.json({ pack, items })
  } catch (error) {
    console.error('[Admin Packs] GET Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pack' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ packId: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { packId } = await context.params
    const id = parseInt(packId, 10)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid pack ID' }, { status: 400 })
    }

    const body = await request.json()
    const { name, description, cover_url, is_active } = body

    const sql = getSql()

    const [updated] = await sql`
      UPDATE photo_packs SET
        name = COALESCE(${name}, name),
        description = ${description},
        cover_url = ${cover_url},
        is_active = COALESCE(${is_active}, is_active),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (!updated) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
    }

    return NextResponse.json({ pack: updated })
  } catch (error) {
    console.error('[Admin Packs] PUT Error:', error)
    return NextResponse.json(
      { error: 'Failed to update pack' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ packId: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { packId } = await context.params
    const id = parseInt(packId, 10)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid pack ID' }, { status: 400 })
    }

    const sql = getSql()

    // Items will be deleted automatically due to ON DELETE CASCADE
    const [deleted] = await sql`
      DELETE FROM photo_packs
      WHERE id = ${id}
      RETURNING id
    `

    if (!deleted) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin Packs] DELETE Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete pack' },
      { status: 500 }
    )
  }
}
