import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

/**
 * GET /api/admin/users
 * Returns paginated list of users with stats
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""
    const offset = (page - 1) * limit

    // Build search condition
    const searchCondition = search
      ? sql`AND (u.telegram_user_id::text LIKE ${'%' + search + '%'} OR u.id::text LIKE ${'%' + search + '%'})`
      : sql``

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM users u
      WHERE 1=1 ${searchCondition}
    `
    const total = parseInt(countResult[0].total)

    // Get users with stats (extended with photo counts and TG status)
    const users = await sql`
      SELECT
        u.id,
        u.telegram_user_id,
        u.telegram_username,
        u.is_banned,
        u.created_at,
        u.updated_at,
        u.pending_referral_code,
        u.pending_generation_tier,

        -- Existing aggregates
        COUNT(DISTINCT a.id) as avatars_count,
        COUNT(DISTINCT p.id) as payments_count,
        SUM(CASE WHEN p.status = 'succeeded' THEN p.amount ELSE 0 END) as total_spent,
        CASE WHEN COUNT(DISTINCT CASE WHEN p.status = 'succeeded' THEN p.id END) > 0
          THEN true ELSE false END as has_paid,

        -- Photo counts (Task 2.1)
        COUNT(DISTINCT rp.id) as ref_photos_total,
        COUNT(DISTINCT gp.id) as gen_photos_total,

        -- Telegram status counts (Task 2.1)
        COUNT(DISTINCT CASE WHEN tmq.status = 'sent' THEN tmq.id END) as tg_sent_count,
        COUNT(DISTINCT CASE WHEN tmq.status = 'pending' THEN tmq.id END) as tg_pending_count,
        COUNT(DISTINCT CASE WHEN tmq.status = 'failed' THEN tmq.id END) as tg_failed_count,

        -- Partner status
        COALESCE(rb.is_partner, false) as is_partner,
        rb.commission_rate,
        rb.partner_approved_at

      FROM users u
      LEFT JOIN avatars a ON a.user_id = u.id
      LEFT JOIN payments p ON p.user_id = u.id
      LEFT JOIN reference_photos rp ON rp.avatar_id = a.id
      LEFT JOIN generated_photos gp ON gp.avatar_id = a.id
      LEFT JOIN telegram_sessions ts ON ts.user_id = u.id
      LEFT JOIN telegram_message_queue tmq ON tmq.telegram_chat_id = ts.telegram_chat_id
      LEFT JOIN referral_balances rb ON rb.user_id = u.id
      WHERE 1=1 ${searchCondition}
      GROUP BY u.id, u.telegram_user_id, u.telegram_username, u.is_banned, u.created_at, u.updated_at, u.pending_referral_code, u.pending_generation_tier, rb.is_partner, rb.commission_rate, rb.partner_approved_at
      ORDER BY u.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `

    return NextResponse.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error("[Admin API] Error fetching users:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FETCH_ERROR",
          userMessage: "Ошибка загрузки пользователей",
          devMessage: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    )
  }
}
