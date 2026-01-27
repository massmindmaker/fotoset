/**
 * GET /api/partner/stats
 *
 * Returns partner dashboard statistics
 *
 * Supports both Telegram and Web users:
 * - Telegram: via telegram_user_id query param
 * - Web: via neon_user_id query param
 *
 * Includes:
 * - Current balance (RUB + TON)
 * - Total earned (all time)
 * - Total withdrawn
 * - Referral counts (total, active, with payments)
 * - Conversion rates
 * - Monthly earnings chart data
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { extractIdentifierFromRequest, findUserByIdentifier } from '@/lib/user-identity'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const telegramUserId = searchParams.get('telegram_user_id')
    // Accept both neon_auth_id and neon_user_id for backwards compatibility
    const neonUserId = searchParams.get('neon_auth_id') || searchParams.get('neon_user_id')

    if (!telegramUserId && !neonUserId) {
      return NextResponse.json(
        { error: 'telegram_user_id or neon_auth_id required' },
        { status: 400 }
      )
    }

    // Get user by identifier
    const identifier = extractIdentifierFromRequest({
      telegram_user_id: telegramUserId,
      neon_auth_id: neonUserId
    })

    const basicUser = await findUserByIdentifier(identifier)

    if (!basicUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get user with referral balance
    const user = await sql`
      SELECT
        u.id,
        u.telegram_user_id,
        u.neon_auth_id,
        rb.id as balance_id,
        rb.referral_code,
        rb.balance_rub,
        rb.balance_ton,
        rb.total_earned_rub,
        rb.total_earned_ton,
        rb.total_withdrawn_rub,
        rb.total_withdrawn_ton,
        rb.is_partner,
        rb.commission_rate,
        rb.promoted_at
      FROM users u
      LEFT JOIN referral_balances rb ON rb.user_id = u.id
      WHERE u.id = ${basicUser.id}
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
      FROM withdrawals
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
        rub: parseFloat(user.total_earned_rub || '0'),
        ton: parseFloat(user.total_earned_ton || '0')
      },
      totalWithdrawn: {
        rub: parseFloat(user.total_withdrawn_rub || '0'),
        ton: parseFloat(user.total_withdrawn_ton || '0')
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
      promotedAt: user.promoted_at,
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
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
