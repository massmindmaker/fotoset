/**
 * GET /api/partner/referrals
 *
 * Returns list of partner's referrals with pagination
 *
 * Authentication methods (in priority order):
 * 1. Partner session cookie (for web login)
 * 2. telegram_user_id query param (for Telegram WebApp)
 * 3. neon_user_id query param (for Neon Auth)
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - status: Filter by status (active, inactive, all)
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { extractIdentifierFromRequest, findUserByIdentifier } from '@/lib/user-identity'
import { getCurrentPartnerSession } from '@/lib/partner/session'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let userId: number | null = null

    // Priority 1: Get userId from partner session cookie (with timeout)
    try {
      const sessionPromise = getCurrentPartnerSession()
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
      const session = await Promise.race([sessionPromise, timeoutPromise])
      if (session?.userId) {
        userId = session.userId
      }
    } catch (e) {
      console.error('[Partner Referrals] Session check error:', e)
      // Session check failed, continue with query params
    }

    // Priority 2: Get from query params (Telegram/Neon auth)
    if (!userId) {
      const telegramUserId = searchParams.get('telegram_user_id')
      const neonUserId = searchParams.get('neon_auth_id') || searchParams.get('neon_user_id')

      if (telegramUserId || neonUserId) {
        const identifier = extractIdentifierFromRequest({
          telegram_user_id: telegramUserId,
          neon_auth_id: neonUserId
        })
        const basicUser = await findUserByIdentifier(identifier)
        if (basicUser) {
          userId = basicUser.id
        }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user with referral balance
    const user = await sql`
      SELECT u.id, rb.id as balance_id
      FROM users u
      LEFT JOIN referral_balances rb ON rb.user_id = u.id
      WHERE u.id = ${userId}
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

    // Get total count using referrals table
    const countResult = await sql`
      SELECT COUNT(DISTINCT r.referred_id) as count
      FROM referrals r
      LEFT JOIN referral_earnings re ON re.referred_id = r.referred_id AND re.referrer_id = r.referrer_id
      WHERE r.referrer_id = ${user.id}
      ${status === 'active' ? sql`AND re.created_at > NOW() - INTERVAL '30 days'` : sql``}
      ${status === 'inactive' ? sql`AND (re.created_at IS NULL OR re.created_at <= NOW() - INTERVAL '30 days')` : sql``}
    `.then((rows: any[]) => rows[0])
    const total = parseInt(countResult?.count || '0')

    // Get referrals with aggregated earnings data
    const referrals = await sql`
      SELECT
        r.referred_id as referred_user_id,
        u.telegram_username,
        COUNT(re.id) as total_payments,
        COALESCE(SUM(re.original_amount), 0) as total_spent,
        COALESCE(SUM(re.amount), 0) as total_commission,
        'RUB' as currency,
        MIN(re.created_at) as first_payment_at,
        MAX(re.created_at) as last_payment_at,
        MAX(re.created_at) as last_activity_at,
        r.created_at,
        CASE
          WHEN MAX(re.created_at) > NOW() - INTERVAL '30 days' THEN 'active'
          ELSE 'inactive'
        END as status
      FROM referrals r
      JOIN users u ON u.id = r.referred_id
      LEFT JOIN referral_earnings re ON re.referred_id = r.referred_id AND re.referrer_id = r.referrer_id
      WHERE r.referrer_id = ${user.id}
      GROUP BY r.referred_id, u.telegram_username, r.created_at
      ${status === 'active' ? sql`HAVING MAX(re.created_at) > NOW() - INTERVAL '30 days'` : sql``}
      ${status === 'inactive' ? sql`HAVING MAX(re.created_at) IS NULL OR MAX(re.created_at) <= NOW() - INTERVAL '30 days'` : sql``}
      ORDER BY SUM(re.amount) DESC NULLS LAST, r.created_at DESC
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
