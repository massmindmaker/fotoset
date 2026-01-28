/**
 * GET /api/partner/earnings
 *
 * Returns partner's earnings history with pagination
 *
 * Authentication methods (in priority order):
 * 1. Partner session cookie (for web login)
 * 2. telegram_user_id query param (for Telegram WebApp)
 * 3. neon_user_id query param (for Neon Auth)
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - status: Filter by status (pending, credited, cancelled, all)
 * - currency: Filter by currency (RUB, TON, all)
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

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
      console.error('[Partner Earnings] Session check error:', e)
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

    // Parse pagination params
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit
    const statusFilter = searchParams.get('status') || 'all'
    const currencyFilter = searchParams.get('currency') || 'all'

    // Build filters
    const statusCondition = statusFilter !== 'all' ? statusFilter : null
    const currencyCondition = currencyFilter !== 'all' ? currencyFilter : null

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM referral_earnings
      WHERE referrer_id = ${userId}
        AND (${statusCondition}::text IS NULL OR status = ${statusCondition})
        AND (${currencyCondition}::text IS NULL OR currency = ${currencyCondition})
    `.then((rows: any[]) => rows[0])
    const total = parseInt(countResult?.count || '0')

    // Get earnings
    const earnings = await sql`
      SELECT
        re.id,
        re.payment_id,
        re.referred_user_id,
        u.telegram_username,
        re.amount,
        re.currency,
        re.commission_rate,
        re.status,
        re.created_at,
        re.credited_at,
        re.cancelled_at,
        re.cancelled_reason,
        p.amount as payment_amount,
        p.provider as payment_provider
      FROM referral_earnings re
      JOIN users u ON u.id = re.referred_user_id
      LEFT JOIN payments p ON p.id = re.payment_id
      WHERE re.referrer_id = ${userId}
        AND (${statusCondition}::text IS NULL OR re.status = ${statusCondition})
        AND (${currencyCondition}::text IS NULL OR re.currency = ${currencyCondition})
      ORDER BY re.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    // Get summary by status
    const summary = await sql`
      SELECT
        status,
        currency,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM referral_earnings
      WHERE referrer_id = ${userId}
      GROUP BY status, currency
    `

    // Transform summary
    const summaryByStatus: Record<string, { count: number; rub: number; ton: number }> = {
      pending: { count: 0, rub: 0, ton: 0 },
      credited: { count: 0, rub: 0, ton: 0 },
      cancelled: { count: 0, rub: 0, ton: 0 },
      confirmed: { count: 0, rub: 0, ton: 0 }
    }

    for (const row of summary) {
      const status = row.status as string
      const currency = (row.currency as string || 'RUB').toLowerCase()
      if (summaryByStatus[status]) {
        summaryByStatus[status].count += parseInt(row.count as string || '0')
        if (currency === 'rub') {
          summaryByStatus[status].rub += parseFloat(row.total as string || '0')
        } else if (currency === 'ton') {
          summaryByStatus[status].ton += parseFloat(row.total as string || '0')
        }
      }
    }

    return NextResponse.json({
      earnings: earnings.map((e: any) => ({
        id: e.id,
        paymentId: e.payment_id,
        referredUser: {
          id: e.referred_user_id,
          username: e.telegram_username ? '@' + e.telegram_username : null
        },
        amount: parseFloat(e.amount || '0'),
        currency: e.currency || 'RUB',
        commissionRate: parseFloat(e.commission_rate || '0'),
        status: e.status,
        createdAt: e.created_at,
        creditedAt: e.credited_at,
        cancelledAt: e.cancelled_at,
        cancelledReason: e.cancelled_reason,
        payment: e.payment_id ? {
          amount: parseFloat(e.payment_amount || '0'),
          provider: e.payment_provider
        } : null
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      summary: summaryByStatus
    })

  } catch (error) {
    console.error('[Partner Earnings] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown',
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined
      },
      { status: 500 }
    )
  }
}
