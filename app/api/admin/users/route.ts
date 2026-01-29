export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getCurrentSession } from "@/lib/admin/session"

/**
 * GET /api/admin/users
 * Returns paginated list of users with stats
 *
 * Fixed: Use subqueries to avoid row multiplication from multiple JOINs
 */
export async function GET(request: NextRequest) {
  const session = await getCurrentSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

    // Get users with stats using subqueries to avoid row multiplication
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

        -- Avatar count (simple subquery)
        (SELECT COUNT(*) FROM avatars WHERE user_id = u.id) as avatars_count,

        -- Payment aggregates (subquery to avoid multiplication)
        COALESCE(pay.payments_count, 0) as payments_count,
        COALESCE(pay.total_spent, 0) as total_spent,
        COALESCE(pay.spent_rub, 0) as spent_rub,
        COALESCE(pay.spent_stars, 0) as spent_stars,
        COALESCE(pay.spent_ton, 0) as spent_ton,

        -- Photo counts (subqueries)
        COALESCE(photos.ref_photos_total, 0) as ref_photos_total,
        COALESCE(photos.gen_photos_total, 0) as gen_photos_total,

        -- Telegram status counts (subquery)
        COALESCE(tg.tg_sent_count, 0) as tg_sent_count,
        COALESCE(tg.tg_pending_count, 0) as tg_pending_count,
        COALESCE(tg.tg_failed_count, 0) as tg_failed_count,

        -- Partner status
        COALESCE(rb.is_partner, false) as is_partner,
        rb.commission_rate,
        rb.partner_approved_at

      FROM users u

      -- Payment stats subquery
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) as payments_count,
          SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as total_spent,
          SUM(CASE WHEN status = 'succeeded' AND COALESCE(provider, 'tbank') = 'tbank' THEN amount ELSE 0 END) as spent_rub,
          SUM(CASE WHEN status = 'succeeded' AND provider = 'stars' THEN stars_amount ELSE 0 END) as spent_stars,
          SUM(CASE WHEN status = 'succeeded' AND provider = 'ton' THEN ton_amount ELSE 0 END) as spent_ton
        FROM payments
        WHERE user_id = u.id
      ) pay ON true

      -- Photo counts subquery
      LEFT JOIN LATERAL (
        SELECT
          (SELECT COUNT(*) FROM reference_photos rp JOIN avatars a ON rp.avatar_id = a.id WHERE a.user_id = u.id) as ref_photos_total,
          (SELECT COUNT(*) FROM generated_photos gp JOIN avatars a ON gp.avatar_id = a.id WHERE a.user_id = u.id) as gen_photos_total
      ) photos ON true

      -- Telegram queue stats subquery
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE status = 'sent') as tg_sent_count,
          COUNT(*) FILTER (WHERE status = 'pending') as tg_pending_count,
          COUNT(*) FILTER (WHERE status = 'failed') as tg_failed_count
        FROM telegram_message_queue
        WHERE telegram_chat_id = u.telegram_user_id
      ) tg ON true

      LEFT JOIN referral_balances rb ON rb.user_id = u.id

      WHERE 1=1 ${searchCondition}
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
