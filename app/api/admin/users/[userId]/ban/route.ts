/**
 * POST /api/admin/users/[userId]/ban
 * Ban or unban a user
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60


import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
import { hasPermission } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'
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
    if (!hasPermission(session.role as 'super_admin' | 'admin' | 'viewer', 'users.ban')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId } = await context.params
    const userIdNum = parseInt(userId, 10)

    if (isNaN(userIdNum)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const body = await request.json()
    const { isBanned, reason } = body

    if (typeof isBanned !== 'boolean') {
      return NextResponse.json({ error: 'isBanned is required (boolean)' }, { status: 400 })
    }
    // Check if user exists
    const [user] = await sql`
      SELECT id, is_banned, telegram_user_id FROM users WHERE id = ${userIdNum}
    `

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update user
    if (isBanned) {
      await sql`
        UPDATE users
        SET
          is_banned = true,
          banned_at = NOW(),
          banned_by = ${session.adminId},
          ban_reason = ${reason || null},
          updated_at = NOW()
        WHERE id = ${userIdNum}
      `
    } else {
      await sql`
        UPDATE users
        SET
          is_banned = false,
          banned_at = NULL,
          banned_by = NULL,
          ban_reason = NULL,
          updated_at = NOW()
        WHERE id = ${userIdNum}
      `
    }

    // Audit log
    await logAdminAction({
      adminId: session.adminId,
      action: isBanned ? 'user_banned' : 'user_unbanned',
      targetType: 'user',
      targetId: userIdNum,
      metadata: {
        previousStatus: user.is_banned,
        newStatus: isBanned,
        reason: reason || null,
        telegramUserId: user.telegram_user_id?.toString()
      }
    })

    return NextResponse.json({
      success: true,
      isBanned,
      message: isBanned ? 'User banned' : 'User unbanned'
    })
  } catch (error) {
    console.error('[Admin User Ban] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update ban status' },
      { status: 500 }
    )
  }
}
