/**
 * GET /api/partner/referrals
 *
 * Returns list of partner's referrals with pagination
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - status: Filter by status (active, inactive, all)
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const telegramUserId = request.headers.get('x-telegram-user-id')

    if (!telegramUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user
    const user = await sql`
      SELECT u.id, rb.id as balance_id
      FROM users u
      LEFT JOIN referral_balances rb ON rb.user_id = u.id
      WHERE u.telegram_user_id = ${telegramUserId}
    `.then((rows: any[]) => rows[0])

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (!user.balance_id) {
      return NextResponse.json({
        referrals: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0
        }
      })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit
    const status = searchParams.get('status') || 'all'

    // Build status filter
    let statusCondition = ''
    if (status === 'active') {
      statusCondition = "AND rs.last_activity_at > NOW() - INTERVAL '30 days'"
    } else if (status === 'inactive') {
      statusCondition = "AND (rs.last_activity_at IS NULL OR rs.last_activity_at <= NOW() - INTERVAL '30 days')"
    }

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM referral_stats rs
      WHERE rs.referrer_id = ${user.id}
      ${status === 'active' ? sql`AND rs.last_activity_at > NOW() - INTERVAL '30 days'` : sql``}
      ${status === 'inactive' ? sql`AND (rs.last_activity_at IS NULL OR rs.last_activity_at <= NOW() - INTERVAL '30 days')` : sql``}
    `.then((rows: any[]) => rows[0])
    const total = parseInt(countResult?.count || '0')

    // Get referrals
    const referrals = await sql`
      SELECT
        rs.referred_user_id,
        u.telegram_username,
        rs.total_payments,
        rs.total_spent,
        rs.total_commission,
        rs.currency,
        rs.first_payment_at,
        rs.last_payment_at,
        rs.last_activity_at,
        rs.created_at,
        CASE
          WHEN rs.last_activity_at > NOW() - INTERVAL '30 days' THEN 'active'
          ELSE 'inactive'
        END as status
      FROM referral_stats rs
      JOIN users u ON u.id = rs.referred_user_id
      WHERE rs.referrer_id = ${user.id}
      ${status === 'active' ? sql`AND rs.last_activity_at > NOW() - INTERVAL '30 days'` : sql``}
      ${status === 'inactive' ? sql`AND (rs.last_activity_at IS NULL OR rs.last_activity_at <= NOW() - INTERVAL '30 days')` : sql``}
      ORDER BY rs.total_commission DESC NULLS LAST, rs.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    return NextResponse.json({
      referrals: referrals.map((r: any) => ({
        id: r.referred_user_id,
        username: r.telegram_username ? '@' + r.telegram_username : null,
        totalPayments: parseInt(r.total_payments || '0'),
        totalSpent: parseFloat(r.total_spent || '0'),
        totalCommission: parseFloat(r.total_commission || '0'),
        currency: r.currency || 'RUB',
        firstPaymentAt: r.first_payment_at,
        lastPaymentAt: r.last_payment_at,
        lastActivityAt: r.last_activity_at,
        registeredAt: r.created_at,
        status: r.status
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      summary: {
        total,
        active: status === 'all' ? referrals.filter((r: any) => r.status === 'active').length : (status === 'active' ? total : 0)
      }
    })

  } catch (error) {
    console.error('[Partner Referrals] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
