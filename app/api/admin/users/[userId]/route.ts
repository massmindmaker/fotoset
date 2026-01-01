/**
 * GET /api/admin/users/[userId]
 * Get detailed user info including avatars, payments, referral data
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

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

    const sql = getSql()

    // Get basic user info first (without optional columns)
    const [user] = await sql`
      SELECT
        id,
        telegram_user_id,
        is_pro,
        referral_code,
        referred_by,
        pending_referral_code,
        created_at,
        updated_at
      FROM users
      WHERE id = ${userIdNum}
    `

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Try to get optional ban/earnings columns if they exist
    let banInfo: { is_banned: boolean; ban_reason: string | null; banned_at: string | null; total_earnings: number } = {
      is_banned: false,
      ban_reason: null,
      banned_at: null,
      total_earnings: 0
    }
    try {
      const [banData] = await sql`
        SELECT
          COALESCE(is_banned, false) as is_banned,
          ban_reason,
          banned_at,
          COALESCE(total_earnings, 0) as total_earnings
        FROM users
        WHERE id = ${userIdNum}
      `
      if (banData) {
        banInfo = {
          is_banned: Boolean(banData.is_banned),
          ban_reason: banData.ban_reason as string | null,
          banned_at: banData.banned_at as string | null,
          total_earnings: Number(banData.total_earnings) || 0
        }
      }
    } catch {
      // Columns might not exist yet, use defaults
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
        created_at
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

    // Get referral stats
    const [referralStats] = await sql`
      SELECT
        COUNT(DISTINCT referred.id) as referral_count,
        COUNT(DISTINCT CASE WHEN referred.is_pro THEN referred.id END) as paid_referral_count,
        COALESCE(SUM(CASE WHEN re.status = 'credited' THEN re.amount ELSE 0 END), 0) as total_earned
      FROM users u
      LEFT JOIN users referred ON referred.referred_by = u.referral_code
      LEFT JOIN referral_earnings re ON re.referrer_id = u.id
      WHERE u.id = ${userIdNum}
    `

    return NextResponse.json({
      user: {
        ...user,
        ...banInfo,
        telegram_user_id: user.telegram_user_id?.toString()
      },
      avatars,
      payments,
      jobs,
      referralStats: referralStats || {
        referral_count: 0,
        paid_referral_count: 0,
        total_earned: 0
      }
    })
  } catch (error) {
    console.error('[Admin User Details] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user details' },
      { status: 500 }
    )
  }
}
