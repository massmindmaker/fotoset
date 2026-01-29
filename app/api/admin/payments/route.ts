export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

/**
 * GET /api/admin/payments
 *
 * Returns paginated list of payments with filters
 *
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - status: string (pending, succeeded, canceled, refunded)
 * - dateFrom: string (ISO date)
 * - dateTo: string (ISO date)
 * - provider: string (tbank, stars, ton)
 * - tierId: string (starter, standard, premium)
 * - search: string (telegram username or user id)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit

    // Filter parameters
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const provider = searchParams.get('provider')
    const tierId = searchParams.get('tierId')
    const search = searchParams.get('search')

    // Build WHERE conditions dynamically
    const conditions: string[] = []
    const values: (string | number)[] = []
    let paramIndex = 1

    if (status && status !== 'all') {
      conditions.push(`p.status = $${paramIndex}`)
      values.push(status)
      paramIndex++
    }

    if (dateFrom) {
      conditions.push(`p.created_at >= $${paramIndex}::date`)
      values.push(dateFrom)
      paramIndex++
    }

    if (dateTo) {
      conditions.push(`p.created_at <= ($${paramIndex}::date + interval '1 day')`)
      values.push(dateTo)
      paramIndex++
    }

    if (provider && provider !== 'all') {
      conditions.push(`COALESCE(p.provider, 'tbank') = $${paramIndex}`)
      values.push(provider)
      paramIndex++
    }

    if (tierId && tierId !== 'all') {
      conditions.push(`p.tier_id = $${paramIndex}`)
      values.push(tierId)
      paramIndex++
    }

    if (search) {
      conditions.push(`(
        u.telegram_username ILIKE $${paramIndex} OR
        u.telegram_user_id::text LIKE $${paramIndex + 1} OR
        p.tbank_payment_id ILIKE $${paramIndex + 2}
      )`)
      values.push(`%${search}%`, `%${search}%`, `%${search}%`)
      paramIndex += 3
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : ''

    // Get total count with filters
    const countQuery = `
      SELECT COUNT(*) as total
      FROM payments p
      LEFT JOIN users u ON u.id = p.user_id
      ${whereClause}
    `
    const countResult = await query<{ total: string }>(countQuery, values)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Add pagination params
    const paginatedValues = [...values, limit, offset]

    // Get payments with user info
    const paymentsQuery = `
      SELECT
        p.id,
        p.tbank_payment_id,
        p.user_id,
        u.telegram_user_id,
        u.telegram_username,
        p.amount,
        p.currency,
        p.status,
        p.tier_id,
        p.photo_count,
        p.refund_amount,
        p.refund_status,
        p.refund_reason,
        p.refund_at,
        p.created_at,
        p.updated_at,
        COALESCE(p.provider, 'tbank') as provider,
        p.telegram_charge_id,
        p.stars_amount,
        p.ton_tx_hash,
        p.ton_amount,
        (
          SELECT COUNT(*) FROM telegram_message_queue tmq
          WHERE tmq.telegram_chat_id = u.telegram_user_id
          AND tmq.status = 'sent'
        ) as tg_sent_count,
        (
          SELECT COUNT(*) FROM generated_photos gp
          JOIN avatars a ON a.id = gp.avatar_id
          WHERE a.user_id = p.user_id
        ) as gen_photos_count
      FROM payments p
      LEFT JOIN users u ON u.id = p.user_id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `
    const paymentsResult = await query(paymentsQuery, paginatedValues)

    return NextResponse.json({
      success: true,
      data: {
        payments: paymentsResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        filters: {
          status,
          dateFrom,
          dateTo,
          provider,
          tierId,
          search,
        },
      },
    })
  } catch (error) {
    console.error("[Admin API] Error fetching payments:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FETCH_ERROR",
          userMessage: "Ошибка загрузки платежей",
          devMessage: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    )
  }
}
