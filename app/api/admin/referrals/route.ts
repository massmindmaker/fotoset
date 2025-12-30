/**
 * GET /api/admin/referrals
 * Get referral system stats and top referrers
 */

import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

export async function GET() {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = getSql()

    // Get overall stats
    const [statsResult] = await sql`
      SELECT
        (SELECT COUNT(*) FROM referral_codes WHERE is_active = true)::int as total_codes,
        (SELECT COUNT(*) FROM referrals)::int as total_referrals,
        (SELECT COALESCE(SUM(amount), 0) FROM referral_earnings WHERE status = 'confirmed')::numeric as total_earnings,
        (SELECT COALESCE(SUM(balance), 0) FROM referral_balances)::numeric as pending_balance,
        (SELECT COALESCE(SUM(total_withdrawn), 0) FROM referral_balances)::numeric as total_withdrawn,
        (SELECT COUNT(*) FROM referral_withdrawals WHERE status = 'pending')::int as pending_withdrawals
    `

    // Get funnel stats (clicked -> registered -> paid)
    const [funnelResult] = await sql`
      SELECT
        (SELECT COUNT(DISTINCT referred_id) FROM referrals)::int as registered,
        (
          SELECT COUNT(DISTINCT r.referred_id)
          FROM referrals r
          JOIN payments p ON p.user_id = r.referred_id AND p.status = 'succeeded'
        )::int as paid
    `

    // Get top referrers
    const topReferrers = await sql`
      SELECT
        rb.user_id,
        u.telegram_user_id,
        rb.referrals_count,
        rb.balance,
        rb.total_earned,
        rb.total_withdrawn,
        rc.code as referral_code,
        (
          SELECT COUNT(*)
          FROM referrals r
          JOIN payments p ON p.user_id = r.referred_id AND p.status = 'succeeded'
          WHERE r.referrer_id = rb.user_id
        )::int as conversions
      FROM referral_balances rb
      JOIN users u ON u.id = rb.user_id
      LEFT JOIN referral_codes rc ON rc.user_id = rb.user_id AND rc.is_active = true
      WHERE rb.referrals_count > 0 OR rb.total_earned > 0
      ORDER BY rb.total_earned DESC
      LIMIT 20
    `

    // Get recent referral earnings
    const recentEarnings = await sql`
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

    return NextResponse.json({
      stats: {
        total_codes: parseInt(String(statsResult?.total_codes || 0), 10),
        total_referrals: parseInt(String(statsResult?.total_referrals || 0), 10),
        total_earnings: parseFloat(String(statsResult?.total_earnings || 0)),
        pending_balance: parseFloat(String(statsResult?.pending_balance || 0)),
        total_withdrawn: parseFloat(String(statsResult?.total_withdrawn || 0)),
        pending_withdrawals: parseInt(String(statsResult?.pending_withdrawals || 0), 10),
        funnel: {
          registered: parseInt(String(funnelResult?.registered || 0), 10),
          paid: parseInt(String(funnelResult?.paid || 0), 10)
        }
      },
      topReferrers: topReferrers.map(r => ({
        user_id: r.user_id,
        telegram_user_id: String(r.telegram_user_id),
        referrals_count: r.referrals_count,
        balance: parseFloat(String(r.balance)),
        total_earned: parseFloat(String(r.total_earned)),
        total_withdrawn: parseFloat(String(r.total_withdrawn)),
        referral_code: r.referral_code,
        conversions: r.conversions
      })),
      recentEarnings: recentEarnings.map(e => ({
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
