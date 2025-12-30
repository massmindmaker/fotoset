/**
 * PUT/DELETE /api/admin/packs/[packId]/items/[itemId]
 * Single pack item management
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ packId: string; itemId: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { packId, itemId } = await context.params
    const packIdNum = parseInt(packId, 10)
    const itemIdNum = parseInt(itemId, 10)

    if (isNaN(packIdNum) || isNaN(itemIdNum)) {
      return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 })
    }

    const body = await request.json()
    const { photo_url, prompt, position } = body

    const sql = getSql()

    const [updated] = await sql`
      UPDATE pack_items SET
        photo_url = COALESCE(${photo_url}, photo_url),
        prompt = ${prompt},
        position = COALESCE(${position}, position),
        updated_at = NOW()
      WHERE id = ${itemIdNum} AND pack_id = ${packIdNum}
      RETURNING *
    `

    if (!updated) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json({ item: updated })
  } catch (error) {
    console.error('[Admin Pack Items] PUT Error:', error)
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ packId: string; itemId: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { packId, itemId } = await context.params
    const packIdNum = parseInt(packId, 10)
    const itemIdNum = parseInt(itemId, 10)

    if (isNaN(packIdNum) || isNaN(itemIdNum)) {
      return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 })
    }

    const sql = getSql()

    const [deleted] = await sql`
      DELETE FROM pack_items
      WHERE id = ${itemIdNum} AND pack_id = ${packIdNum}
      RETURNING id
    `

    if (!deleted) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin Pack Items] DELETE Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}
