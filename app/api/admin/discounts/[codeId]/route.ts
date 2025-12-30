/**
 * GET/PUT/DELETE /api/admin/discounts/[codeId]
 * Single promo code management
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
  context: { params: Promise<{ codeId: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { codeId } = await context.params
    const id = parseInt(codeId, 10)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid code ID' }, { status: 400 })
    }

    const sql = getSql()

    const [code] = await sql`
      SELECT
        pc.*,
        au.email as admin_email
      FROM promo_codes pc
      LEFT JOIN admin_users au ON au.id = pc.created_by
      WHERE pc.id = ${id}
    `

    if (!code) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
    }

    // Get usage history
    const usages = await sql`
      SELECT
        pcu.id,
        pcu.user_id,
        pcu.payment_id,
        pcu.discount_amount,
        pcu.used_at,
        u.telegram_user_id,
        u.telegram_username
      FROM promo_code_usages pcu
      LEFT JOIN users u ON u.id = pcu.user_id
      WHERE pcu.promo_code_id = ${id}
      ORDER BY pcu.used_at DESC
      LIMIT 50
    `

    return NextResponse.json({ code, usages })
  } catch (error) {
    console.error('[Admin Discounts] GET Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch promo code' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ codeId: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { codeId } = await context.params
    const id = parseInt(codeId, 10)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid code ID' }, { status: 400 })
    }

    const body = await request.json()
    const {
      code,
      discount_type,
      discount_value,
      max_uses,
      valid_from,
      valid_until,
      is_active
    } = body

    // Validation
    if (discount_type && !['percentage', 'fixed'].includes(discount_type)) {
      return NextResponse.json(
        { error: 'discount_type must be "percentage" or "fixed"' },
        { status: 400 }
      )
    }

    const sql = getSql()

    // If changing code, check for duplicates
    if (code) {
      const [existing] = await sql`
        SELECT id FROM promo_codes WHERE UPPER(code) = UPPER(${code}) AND id != ${id}
      `
      if (existing) {
        return NextResponse.json(
          { error: 'Promo code already exists' },
          { status: 409 }
        )
      }
    }

    const [updated] = await sql`
      UPDATE promo_codes SET
        code = COALESCE(${code ? code.toUpperCase() : null}, code),
        discount_type = COALESCE(${discount_type}, discount_type),
        discount_value = COALESCE(${discount_value}, discount_value),
        max_uses = ${max_uses},
        valid_from = ${valid_from},
        valid_until = ${valid_until},
        is_active = COALESCE(${is_active}, is_active),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (!updated) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
    }

    return NextResponse.json({ code: updated })
  } catch (error) {
    console.error('[Admin Discounts] PUT Error:', error)
    return NextResponse.json(
      { error: 'Failed to update promo code' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ codeId: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { codeId } = await context.params
    const id = parseInt(codeId, 10)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid code ID' }, { status: 400 })
    }

    const sql = getSql()

    // Check if code has been used
    const [usage] = await sql`
      SELECT COUNT(*) as count FROM promo_code_usages WHERE promo_code_id = ${id}
    `

    if (parseInt(usage?.count || '0', 10) > 0) {
      // Soft delete - just deactivate
      await sql`
        UPDATE promo_codes SET is_active = false, updated_at = NOW()
        WHERE id = ${id}
      `
      return NextResponse.json({ success: true, softDeleted: true })
    }

    // Hard delete if never used
    const [deleted] = await sql`
      DELETE FROM promo_codes
      WHERE id = ${id}
      RETURNING id
    `

    if (!deleted) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin Discounts] DELETE Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete promo code' },
      { status: 500 }
    )
  }
}
