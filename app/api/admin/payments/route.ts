import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

/**
 * GET /api/admin/payments
 *
 * Returns paginated list of payments with filters
 *
 * Query Parameters:
 * - status: "pending" | "succeeded" | "canceled" | "refunded" (optional)
 * - dateFrom: ISO timestamp (optional)
 * - dateTo: ISO timestamp (optional)
 * - amountMin: number (optional)
 * - amountMax: number (optional)
 * - telegramUserId: number (optional)
 * - tierId: "starter" | "standard" | "premium" (optional)
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl

    // Parse filters
    const status = searchParams.get('status') || undefined
    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined
    const amountMin = searchParams.get('amountMin')
      ? parseFloat(searchParams.get('amountMin')!)
      : undefined
    const amountMax = searchParams.get('amountMax')
      ? parseFloat(searchParams.get('amountMax')!)
      : undefined
    const telegramUserId = searchParams.get('telegramUserId')
      ? parseInt(searchParams.get('telegramUserId')!)
      : undefined
    const tierId = searchParams.get('tierId') || undefined

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit

    // Build WHERE conditions
    const conditions = []
    const params: any[] = []

    if (status) {
      conditions.push(`p.status = $${params.length + 1}`)
      params.push(status)
    }

    if (dateFrom) {
      conditions.push(`p.created_at >= $${params.length + 1}`)
      params.push(dateFrom)
    }

    if (dateTo) {
      conditions.push(`p.created_at <= $${params.length + 1}`)
      params.push(dateTo)
    }

    if (amountMin !== undefined) {
      conditions.push(`p.amount >= $${params.length + 1}`)
      params.push(amountMin)
    }

    if (amountMax !== undefined) {
      conditions.push(`p.amount <= $${params.length + 1}`)
      params.push(amountMax)
    }

    if (telegramUserId) {
      conditions.push(`u.telegram_user_id = $${params.length + 1}`)
      params.push(telegramUserId)
    }

    if (tierId) {
      conditions.push(`p.tier_id = $${params.length + 1}`)
      params.push(tierId)
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : ''

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM payments p
      LEFT JOIN users u ON u.id = p.user_id
      ${sql.unsafe(whereClause)}
    `
    const total = parseInt(countResult[0].total)

    // Get payments with user info
    const payments = await sql`
      SELECT
        p.id,
        p.tbank_payment_id,
        p.user_id,
        u.telegram_user_id,
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
        p.updated_at
      FROM payments p
      LEFT JOIN users u ON u.id = p.user_id
      ${sql.unsafe(whereClause)}
      ORDER BY p.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `

    return NextResponse.json({
      success: true,
      data: {
        payments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
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
