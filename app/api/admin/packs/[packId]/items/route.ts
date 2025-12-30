/**
 * GET/POST /api/admin/packs/[packId]/items
 * Pack items management
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

    const items = await sql`
      SELECT *
      FROM pack_items
      WHERE pack_id = ${id}
      ORDER BY position ASC, created_at ASC
    `

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[Admin Pack Items] GET Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    )
  }
}

export async function POST(
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
    const { photo_url, prompt, position } = body

    if (!photo_url) {
      return NextResponse.json(
        { error: 'Photo URL is required' },
        { status: 400 }
      )
    }

    const sql = getSql()

    // Verify pack exists
    const [pack] = await sql`SELECT id FROM photo_packs WHERE id = ${id}`
    if (!pack) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
    }

    // Get next position if not specified
    let itemPosition = position
    if (itemPosition === undefined || itemPosition === null) {
      const [maxPos] = await sql`
        SELECT COALESCE(MAX(position), -1) + 1 as next_position
        FROM pack_items
        WHERE pack_id = ${id}
      `
      itemPosition = maxPos.next_position
    }

    const [newItem] = await sql`
      INSERT INTO pack_items (
        pack_id,
        photo_url,
        prompt,
        position
      ) VALUES (
        ${id},
        ${photo_url},
        ${prompt || null},
        ${itemPosition}
      )
      RETURNING *
    `

    return NextResponse.json({ item: newItem }, { status: 201 })
  } catch (error) {
    console.error('[Admin Pack Items] POST Error:', error)
    return NextResponse.json(
      { error: 'Failed to add item' },
      { status: 500 }
    )
  }
}

// Bulk update positions (for drag & drop reordering)
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
    const { items } = body // Array of { id, position }

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Items array is required' },
        { status: 400 }
      )
    }

    const sql = getSql()

    // Update each item's position
    for (const item of items) {
      if (item.id && typeof item.position === 'number') {
        await sql`
          UPDATE pack_items
          SET position = ${item.position}, updated_at = NOW()
          WHERE id = ${item.id} AND pack_id = ${id}
        `
      }
    }

    // Return updated items
    const updatedItems = await sql`
      SELECT *
      FROM pack_items
      WHERE pack_id = ${id}
      ORDER BY position ASC, created_at ASC
    `

    return NextResponse.json({ items: updatedItems })
  } catch (error) {
    console.error('[Admin Pack Items] PUT Error:', error)
    return NextResponse.json(
      { error: 'Failed to update items' },
      { status: 500 }
    )
  }
}
