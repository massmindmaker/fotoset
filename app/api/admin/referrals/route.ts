/**
 * GET /api/admin/referrals
 * Get referral system stats and top referrers
 * Optimized: parallel queries instead of sequential
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
export async function GET() {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Run all queries in parallel
    const [statsResult, funnelResult, topReferrers, recentEarnings] = await Promise.all([
      // Stats query
      sql`
        SELECT
          (SELECT COUNT(*) FROM referral_codes WHERE is_active = true)::int as total_codes,
          (SELECT COUNT(*) FROM referrals)::int as total_referrals,
          (SELECT COALESCE(SUM(amount), 0) FROM referral_earnings WHERE status = 'confirmed')::numeric as total_earnings,
          (SELECT COALESCE(SUM(balance), 0) FROM referral_balances)::numeric as pending_balance,
          (SELECT COALESCE(SUM(total_withdrawn), 0) FROM referral_balances)::numeric as total_withdrawn,
          (SELECT COUNT(*) FROM referral_withdrawals WHERE status = 'pending')::int as pending_withdrawals,
          (SELECT COALESCE(SUM(earned_rub), 0) FROM referral_balances)::numeric as earned_rub,
          (SELECT COALESCE(SUM(earned_ton), 0) FROM referral_balances)::numeric as earned_ton,
          (SELECT COALESCE(SUM(balance_rub), 0) FROM referral_balances)::numeric as balance_rub,
          (SELECT COALESCE(SUM(balance_ton), 0) FROM referral_balances)::numeric as balance_ton,
          (SELECT COALESCE(SUM(withdrawn_rub), 0) FROM referral_balances)::numeric as withdrawn_rub,
          (SELECT COALESCE(SUM(withdrawn_ton), 0) FROM referral_balances)::numeric as withdrawn_ton
      `.then((r: any) => r[0]),

      // Funnel query
      sql`
        SELECT
          (SELECT COUNT(DISTINCT referred_id) FROM referrals)::int as registered,
          (
            SELECT COUNT(DISTINCT r.referred_id)
            FROM referrals r
            WHERE EXISTS (SELECT 1 FROM payments p WHERE p.user_id = r.referred_id AND p.status = 'succeeded')
          )::int as paid
      `.then((r: any) => r[0]),

      // Top referrers with precomputed conversions
      sql`
        WITH conversions AS (
          SELECT r.referrer_id, COUNT(DISTINCT r.referred_id)::int as cnt
          FROM referrals r
          WHERE EXISTS (SELECT 1 FROM payments p WHERE p.user_id = r.referred_id AND p.status = 'succeeded')
          GROUP BY r.referrer_id
        )
        SELECT
          rb.user_id,
          u.telegram_user_id,
          rb.referrals_count,
          rb.balance,
          rb.total_earned,
          rb.total_withdrawn,
          rc.code as referral_code,
          COALESCE(c.cnt, 0)::int as conversions
        FROM referral_balances rb
        JOIN users u ON u.id = rb.user_id
        LEFT JOIN referral_codes rc ON rc.user_id = rb.user_id AND rc.is_active = true
        LEFT JOIN conversions c ON c.referrer_id = rb.user_id
        WHERE rb.referrals_count > 0 OR rb.total_earned > 0
        ORDER BY rb.total_earned DESC
        LIMIT 20
      `,

      // Recent earnings
      sql`
        SELECT
          re.id,
          re.referrer_id,
          ru.telegram_user_id as referrer_telegram_id,
          re.referred_id,
          ru2.telegram_user_id as referred_telegram_id,
          re.amount,
          re.status,
          re.created_at,
          p.tbank_payment_id
        FROM referral_earnings re
        JOIN users ru ON ru.id = re.referrer_id
        JOIN users ru2 ON ru2.id = re.referred_id
        LEFT JOIN payments p ON p.id = re.payment_id
        ORDER BY re.created_at DESC
        LIMIT 20
      `
    ])

    return NextResponse.json({
      stats: {
        total_codes: parseInt(String(statsResult?.total_codes || 0), 10),
        total_referrals: parseInt(String(statsResult?.total_referrals || 0), 10),
        total_earnings: parseFloat(String(statsResult?.total_earnings || 0)),
        pending_balance: parseFloat(String(statsResult?.pending_balance || 0)),
        total_withdrawn: parseFloat(String(statsResult?.total_withdrawn || 0)),
        pending_withdrawals: parseInt(String(statsResult?.pending_withdrawals || 0), 10),
        earned_rub: parseFloat(String(statsResult?.earned_rub || 0)),
        earned_ton: parseFloat(String(statsResult?.earned_ton || 0)),
        balance_rub: parseFloat(String(statsResult?.balance_rub || 0)),
        balance_ton: parseFloat(String(statsResult?.balance_ton || 0)),
        withdrawn_rub: parseFloat(String(statsResult?.withdrawn_rub || 0)),
        withdrawn_ton: parseFloat(String(statsResult?.withdrawn_ton || 0)),
        funnel: {
          registered: parseInt(String(funnelResult?.registered || 0), 10),
          paid: parseInt(String(funnelResult?.paid || 0), 10)
        }
      },
      topReferrers: topReferrers.map((r: any) => ({
        user_id: r.user_id,
        telegram_user_id: String(r.telegram_user_id),
        referrals_count: r.referrals_count,
        balance: parseFloat(String(r.balance)),
        total_earned: parseFloat(String(r.total_earned)),
        total_withdrawn: parseFloat(String(r.total_withdrawn)),
        referral_code: r.referral_code,
        conversions: r.conversions
      })),
      recentEarnings: recentEarnings.map((e: any) => ({
        id: e.id,
        referrer_id: e.referrer_id,
        referrer_telegram_id: String(e.referrer_telegram_id),
        referred_id: e.referred_id,
        referred_telegram_id: String(e.referred_telegram_id),
        amount: parseFloat(String(e.amount)),
        status: e.status,
        created_at: e.created_at,
        payment_id: e.tbank_payment_id
      }))
    })
  } catch (error) {
    console.error('[Admin Referrals] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch referral stats' },
      { status: 500 }
    )
  }
}
