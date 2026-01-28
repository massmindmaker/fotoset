/**
 * GET /api/partner/stats
 *
 * Returns partner dashboard statistics
 *
 * Authentication methods (in priority order):
 * 1. Partner session cookie (for web login)
 * 2. telegram_user_id query param (for Telegram WebApp)
 * 3. neon_user_id query param (for Neon Auth)
 *
 * Includes:
 * - Current balance (RUB + TON)
 * - Total earned (all time)
 * - Total withdrawn
 * - Referral counts (total, active, with payments)
 * - Conversion rates
 * - Monthly earnings chart data
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { extractIdentifierFromRequest, findUserByIdentifier } from '@/lib/user-identity'
import { getCurrentPartnerSession } from '@/lib/partner/session'

export async function GET(request: NextRequest) {
  try {
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
      console.error('[Partner Stats] Session check error:', e)
      // Session check failed, continue with query params
    }

    // Priority 2: Get from query params (Telegram/Neon auth)
    if (!userId) {
      const { searchParams } = new URL(request.url)
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

    // Get user with referral balance using userId from session or query params
    const user = await sql`
      SELECT
        u.id,
        u.telegram_user_id,
        u.neon_auth_id,
        rb.id as balance_id,
        rb.referral_code,
        rb.balance_rub,
        rb.balance_ton,
        rb.earned_rub,
        rb.earned_ton,
        rb.withdrawn_rub,
        rb.withdrawn_ton,
        rb.is_partner,
        rb.commission_rate
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
      // User has no referral balance - return empty stats
      return NextResponse.json({
        balance: {
          rub: 0,
          ton: 0
        },
        totalEarned: {
          rub: 0,
          ton: 0
        },
        totalWithdrawn: {
          rub: 0,
          ton: 0
        },
        referrals: {
          total: 0,
          active: 0,
          withPayments: 0
        },
        conversion: {
          registrationToPayment: 0,
          overall: 0
        },
        isPartner: false,
        commissionRate: 0.10,
        referralCode: null,
        monthlyEarnings: []
      })
    }

    // Get referral counts
    const referralStats = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN last_activity_at > NOW() - INTERVAL '30 days' THEN 1 END) as active_30d,
        COUNT(CASE WHEN total_spent > 0 THEN 1 END) as with_payments
      FROM referral_stats
      WHERE referrer_id = ${user.id}
    `.then((rows: any[]) => rows[0])

    // Get pending earnings count
    const pendingEarnings = await sql`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN currency = 'RUB' THEN amount ELSE 0 END), 0) as pending_rub,
        COALESCE(SUM(CASE WHEN currency = 'TON' THEN amount ELSE 0 END), 0) as pending_ton
      FROM referral_earnings
      WHERE referrer_id = ${user.id} AND status = 'pending'
    `.then((rows: any[]) => rows[0])

    // Get monthly earnings (last 12 months)
    const monthlyEarnings = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', credited_at), 'YYYY-MM') as month,
        SUM(CASE WHEN currency = 'RUB' THEN amount ELSE 0 END) as rub,
        SUM(CASE WHEN currency = 'TON' THEN amount ELSE 0 END) as ton,
        COUNT(*) as count
      FROM referral_earnings
      WHERE referrer_id = ${user.id}
        AND status IN ('credited', 'confirmed')
        AND credited_at > NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', credited_at)
      ORDER BY month DESC
      LIMIT 12
    `

    // Get pending withdrawals
    const pendingWithdrawals = await sql`
      SELECT COALESCE(SUM(amount), 0) as pending
      FROM referral_withdrawals
      WHERE user_id = ${user.id} AND status IN ('pending', 'processing')
    `.then((rows: any[]) => parseFloat(rows[0]?.pending || '0'))

    // Calculate available balance
    const balanceRub = parseFloat(user.balance_rub || '0')
    const availableRub = balanceRub - pendingWithdrawals

    // Conversion rates
    const totalReferrals = parseInt(referralStats?.total || '0')
    const withPayments = parseInt(referralStats?.with_payments || '0')
    const conversionRate = totalReferrals > 0 ? (withPayments / totalReferrals) * 100 : 0

    return NextResponse.json({
      balance: {
        rub: balanceRub,
        ton: parseFloat(user.balance_ton || '0'),
        availableRub, // After pending withdrawals
        pendingWithdrawals
      },
      pendingEarnings: {
        count: parseInt(pendingEarnings?.count || '0'),
        rub: parseFloat(pendingEarnings?.pending_rub || '0'),
        ton: parseFloat(pendingEarnings?.pending_ton || '0')
      },
      totalEarned: {
        rub: parseFloat(user.earned_rub || '0'),
        ton: parseFloat(user.earned_ton || '0')
      },
      totalWithdrawn: {
        rub: parseFloat(user.withdrawn_rub || '0'),
        ton: parseFloat(user.withdrawn_ton || '0')
      },
      referrals: {
        total: totalReferrals,
        active: parseInt(referralStats?.active_30d || '0'),
        withPayments
      },
      conversion: {
        registrationToPayment: Math.round(conversionRate * 10) / 10
      },
      isPartner: user.is_partner || false,
      commissionRate: parseFloat(user.commission_rate || '0.10'),
      referralCode: user.referral_code,
      monthlyEarnings: monthlyEarnings.map((m: any) => ({
        month: m.month,
        rub: parseFloat(m.rub || '0'),
        ton: parseFloat(m.ton || '0'),
        count: parseInt(m.count || '0')
      }))
    })

  } catch (error) {
    console.error('[Partner Stats] Error:', error)
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
