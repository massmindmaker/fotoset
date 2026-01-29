/**
 * POST /api/admin/notifications/[id]/read
 * Mark notification as read
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const notificationId = parseInt(id, 10)

    if (isNaN(notificationId)) {
      return NextResponse.json({ error: 'Invalid notification ID' }, { status: 400 })
    }
    // Mark as read
    await sql`
      UPDATE admin_notifications
      SET is_read = true
      WHERE id = ${notificationId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin Notifications Mark Read] Error:', error)
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    )
  }
}
