/**
 * GET/POST /api/admin/discounts
 * Promo codes management
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
    const activeOnly = searchParams.get('active') === 'true'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const offset = (page - 1) * limit

    const sql = getSql()

    // Get total count
    const countResult = activeOnly
      ? await sql`SELECT COUNT(*) as total FROM promo_codes WHERE is_active = true`
      : await sql`SELECT COUNT(*) as total FROM promo_codes`
    const total = parseInt(countResult[0]?.total || '0', 10)

    // Get promo codes with usage stats
    const codes = activeOnly
      ? await sql`
          SELECT
            pc.id,
            pc.code,
            pc.discount_type,
            pc.discount_value,
            pc.max_uses,
            pc.current_uses,
            pc.valid_from,
            pc.valid_until,
            pc.is_active,
            pc.created_by,
            pc.created_at,
            au.email as admin_email
          FROM promo_codes pc
          LEFT JOIN admin_users au ON au.id = pc.created_by
          WHERE pc.is_active = true
          ORDER BY pc.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `
      : await sql`
          SELECT
            pc.id,
            pc.code,
            pc.discount_type,
            pc.discount_value,
            pc.max_uses,
            pc.current_uses,
            pc.valid_from,
            pc.valid_until,
            pc.is_active,
            pc.created_by,
            pc.created_at,
            au.email as admin_email
          FROM promo_codes pc
          LEFT JOIN admin_users au ON au.id = pc.created_by
          ORDER BY pc.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `

    // Get stats
    const [stats] = await sql`
      SELECT
        COUNT(*) as total_codes,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_codes,
        COUNT(CASE WHEN valid_until < NOW() THEN 1 END) as expired_codes,
        SUM(current_uses) as total_uses
      FROM promo_codes
    `

    return NextResponse.json({
      codes,
      stats: {
        totalCodes: parseInt(stats?.total_codes || '0', 10),
        activeCodes: parseInt(stats?.active_codes || '0', 10),
        expiredCodes: parseInt(stats?.expired_codes || '0', 10),
        totalUses: parseInt(stats?.total_uses || '0', 10)
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('[Admin Discounts] GET Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch promo codes' },
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
    if (!code || !discount_type || discount_value === undefined) {
      return NextResponse.json(
        { error: 'Code, discount_type and discount_value are required' },
        { status: 400 }
      )
    }

    if (!['percentage', 'fixed'].includes(discount_type)) {
      return NextResponse.json(
        { error: 'discount_type must be "percentage" or "fixed"' },
        { status: 400 }
      )
    }

    if (discount_type === 'percentage' && (discount_value < 0 || discount_value > 100)) {
      return NextResponse.json(
        { error: 'Percentage discount must be between 0 and 100' },
        { status: 400 }
      )
    }

    const sql = getSql()

    // Check if code already exists
    const [existing] = await sql`
      SELECT id FROM promo_codes WHERE UPPER(code) = UPPER(${code})
    `

    if (existing) {
      return NextResponse.json(
        { error: 'Promo code already exists' },
        { status: 409 }
      )
    }

    const [newCode] = await sql`
      INSERT INTO promo_codes (
        code,
        discount_type,
        discount_value,
        max_uses,
        valid_from,
        valid_until,
        is_active,
        created_by
      ) VALUES (
        ${code.toUpperCase()},
        ${discount_type},
        ${discount_value},
        ${max_uses || null},
        ${valid_from || null},
        ${valid_until || null},
        ${is_active !== false},
        ${session.adminId}
      )
      RETURNING *
    `

    return NextResponse.json({ code: newCode }, { status: 201 })
  } catch (error) {
    console.error('[Admin Discounts] POST Error:', error)
    return NextResponse.json(
      { error: 'Failed to create promo code' },
      { status: 500 }
    )
  }
}
