import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getCurrentMode } from "@/lib/admin/mode"

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
 * - provider: "tbank" | "stars" | "ton" (optional)
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
    const telegramUserId = searchParams.get('telegramUserId') || undefined
    const tierId = searchParams.get('tierId') || undefined
    const provider = searchParams.get('provider') || undefined

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit

    // Filter by current mode (test vs production)
    const mode = await getCurrentMode()
    const isTestMode = mode === 'test'

    // Build dynamic conditions using tagged template literals
    const statusCondition = status ? sql`AND p.status = ${status}` : sql``
    const dateFromCondition = dateFrom ? sql`AND p.created_at >= ${dateFrom}` : sql``
    const dateToCondition = dateTo ? sql`AND p.created_at <= ${dateTo}` : sql``
    const amountMinCondition = amountMin !== undefined ? sql`AND p.amount >= ${amountMin}` : sql``
    const amountMaxCondition = amountMax !== undefined ? sql`AND p.amount <= ${amountMax}` : sql``
    const telegramCondition = telegramUserId ? sql`AND u.telegram_user_id = ${telegramUserId}` : sql``
    const tierCondition = tierId ? sql`AND p.tier_id = ${tierId}` : sql``
    const providerCondition = provider ? sql`AND COALESCE(p.provider, 'tbank') = ${provider}` : sql``
    const modeCondition = sql`AND COALESCE(p.is_test_mode, false) = ${isTestMode}`

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM payments p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE 1=1
        ${statusCondition}
        ${dateFromCondition}
        ${dateToCondition}
        ${amountMinCondition}
        ${amountMaxCondition}
        ${telegramCondition}
        ${tierCondition}
        ${providerCondition}
        ${modeCondition}
    `
    const total = parseInt(countResult[0].total)

    // Get payments with user info and telegram delivery stats
    const payments = await sql`
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
        p.refund_id,
        p.email,
        p.error_code,
        p.error_message,
        p.created_at,
        p.updated_at,
        -- Provider info
        COALESCE(p.provider, 'tbank') as provider,
        p.original_amount,
        p.original_currency,
        p.exchange_rate,
        -- Provider-specific fields
        p.telegram_charge_id,
        p.stars_amount,
        p.ton_tx_hash,
        p.ton_amount,
        p.ton_sender_address,
        p.ton_confirmations,
        -- Count photos sent to Telegram for this payment (within 1 day of payment)
        COALESCE((
          SELECT COUNT(*)::int
          FROM telegram_message_queue tmq
          WHERE tmq.telegram_chat_id = u.telegram_user_id
            AND tmq.status = 'sent'
            AND tmq.message_type = 'photo'
            AND tmq.created_at >= p.created_at
            AND tmq.created_at <= p.created_at + interval '1 day'
        ), 0) as tg_sent_count,
        -- Count generated photos for this user (within 1 day of payment)
        COALESCE((
          SELECT COUNT(*)::int
          FROM generated_photos gp
          JOIN avatars a ON a.id = gp.avatar_id
          WHERE a.user_id = p.user_id
            AND gp.created_at >= p.created_at
            AND gp.created_at <= p.created_at + interval '1 day'
        ), 0) as gen_photos_count
      FROM payments p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE 1=1
        ${statusCondition}
        ${dateFromCondition}
        ${dateToCondition}
        ${amountMinCondition}
        ${amountMaxCondition}
        ${telegramCondition}
        ${tierCondition}
        ${providerCondition}
        ${modeCondition}
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
