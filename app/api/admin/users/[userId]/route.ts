/**
 * GET /api/admin/users/[userId]
 * Get detailed user info including avatars, payments, referral data
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await context.params
    const userIdNum = parseInt(userId, 10)

    if (isNaN(userIdNum)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }
    // Get basic user info (actual columns in DB)
    const [user] = await sql`
      SELECT
        id,
        telegram_user_id,
        telegram_username,
        is_banned,
        ban_reason,
        banned_at,
        pending_referral_code,
        created_at,
        updated_at
      FROM users
      WHERE id = ${userIdNum}
    `

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get referral code for this user
    let referralCode = null
    try {
      const [code] = await sql`
        SELECT code FROM referral_codes WHERE user_id = ${userIdNum} AND is_active = true LIMIT 1
      `
      if (code) referralCode = code.code
    } catch {
      // referral_codes table may not exist
    }

    // Get who referred this user
    let referredBy = null
    try {
      const [ref] = await sql`
        SELECT u.telegram_username, u.telegram_user_id
        FROM referrals r
        JOIN users u ON u.id = r.referrer_id
        WHERE r.referred_id = ${userIdNum}
        LIMIT 1
      `
      if (ref) referredBy = ref.telegram_username || ref.telegram_user_id?.toString()
    } catch {
      // referrals table may not exist
    }

    // Get avatars
    const avatars = await sql`
      SELECT
        id,
        name,
        status,
        thumbnail_url,
        created_at,
        (SELECT COUNT(*) FROM generated_photos WHERE avatar_id = avatars.id) as photo_count
      FROM avatars
      WHERE user_id = ${userIdNum}
      ORDER BY created_at DESC
    `

    // Get payments
    const payments = await sql`
      SELECT
        id,
        tbank_payment_id,
        amount,
        tier_id,
        photo_count,
        status,
        created_at,
        COALESCE(provider, 'tbank') as provider,
        stars_amount,
        ton_amount,
        telegram_charge_id,
        ton_tx_hash
      FROM payments
      WHERE user_id = ${userIdNum}
      ORDER BY created_at DESC
      LIMIT 20
    `

    // Get generation jobs
    const jobs = await sql`
      SELECT
        gj.id,
        gj.avatar_id,
        gj.style_id,
        gj.status,
        gj.total_photos,
        gj.completed_photos,
        gj.error_message,
        gj.created_at,
        a.name as avatar_name
      FROM generation_jobs gj
      LEFT JOIN avatars a ON a.id = gj.avatar_id
      WHERE a.user_id = ${userIdNum}
      ORDER BY gj.created_at DESC
      LIMIT 20
    `

    // Get referral stats from referrals table
    let referralStats = { referral_count: 0, paid_referral_count: 0, total_earned: 0 }
    try {
      const [stats] = await sql`
        SELECT COUNT(*) as referral_count
        FROM referrals
        WHERE referrer_id = ${userIdNum}
      `
      if (stats) {
        referralStats.referral_count = parseInt(String(stats.referral_count)) || 0
      }
      // Get count of referrals who made a payment
      const [paidStats] = await sql`
        SELECT COUNT(DISTINCT r.referred_id) as paid_referral_count
        FROM referrals r
        JOIN payments p ON p.user_id = r.referred_id
        WHERE r.referrer_id = ${userIdNum} AND p.status = 'succeeded'
      `
      if (paidStats) {
        referralStats.paid_referral_count = parseInt(String(paidStats.paid_referral_count)) || 0
      }
      // Get total earnings
      const [earnings] = await sql`
        SELECT COALESCE(SUM(amount), 0) as total_earned
        FROM referral_earnings
        WHERE user_id = ${userIdNum}
      `
      if (earnings) {
        referralStats.total_earned = parseFloat(String(earnings.total_earned)) || 0
      }
    } catch {
      // referral tables may not exist
    }

    return NextResponse.json({
      user: {
        ...user,
        referral_code: referralCode,
        referred_by: referredBy,
        telegram_user_id: user.telegram_user_id?.toString()
      },
      avatars,
      payments,
      jobs,
      referralStats
    })
  } catch (error) {
    console.error('[Admin User Details] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user details' },
      { status: 500 }
    )
  }
}
