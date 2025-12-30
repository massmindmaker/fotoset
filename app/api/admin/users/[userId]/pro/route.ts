/**
 * POST /api/admin/users/[userId]/pro
 * Grant or revoke Pro status for a user
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'
import { hasPermission } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    if (!hasPermission(session.role as 'super_admin' | 'admin' | 'viewer', 'users.grant_pro')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId } = await context.params
    const userIdNum = parseInt(userId, 10)

    if (isNaN(userIdNum)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const body = await request.json()
    const { isPro, reason } = body

    if (typeof isPro !== 'boolean') {
      return NextResponse.json({ error: 'isPro is required (boolean)' }, { status: 400 })
    }

    const sql = getSql()

    // Check if user exists
    const [user] = await sql`
      SELECT id, is_pro, telegram_user_id FROM users WHERE id = ${userIdNum}
    `

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update user
    await sql`
      UPDATE users
      SET is_pro = ${isPro}, updated_at = NOW()
      WHERE id = ${userIdNum}
    `

    // Audit log
    await logAdminAction({
      adminId: session.adminId,
      action: isPro ? 'user_granted_pro' : 'user_revoked_pro',
      targetType: 'user',
      targetId: userIdNum,
      metadata: {
        previousStatus: user.is_pro,
        newStatus: isPro,
        reason: reason || null,
        telegramUserId: user.telegram_user_id?.toString()
      }
    })

    return NextResponse.json({
      success: true,
      isPro,
      message: isPro ? 'Pro status granted' : 'Pro status revoked'
    })
  } catch (error) {
    console.error('[Admin User Pro] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update pro status' },
      { status: 500 }
    )
  }
}
