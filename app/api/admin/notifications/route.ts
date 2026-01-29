/**
 * GET /api/admin/notifications
 * Get admin notifications list
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
export interface AdminNotification {
  id: number
  type: string
  title: string
  message: string | null
  metadata: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    // Check if table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'admin_notifications'
      ) as exists
    `

    if (!tableCheck[0]?.exists) {
      // Create table if it doesn't exist
      await sql`
        CREATE TABLE IF NOT EXISTS admin_notifications (
          id SERIAL PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT,
          metadata JSONB,
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS idx_admin_notifications_created
        ON admin_notifications(created_at DESC)
      `
      await sql`
        CREATE INDEX IF NOT EXISTS idx_admin_notifications_read
        ON admin_notifications(is_read)
      `

      return NextResponse.json({
        notifications: [],
        unread_count: 0
      })
    }

    // Get notifications
    const unreadFilter = unreadOnly ? true : null

    const notifications = await sql`
      SELECT id, type, title, message, metadata, is_read, created_at
      FROM admin_notifications
      WHERE (${unreadFilter}::boolean IS NULL OR is_read = false)
      ORDER BY created_at DESC
      LIMIT ${limit}
    `

    // Get unread count
    const [countResult] = await sql`
      SELECT COUNT(*) as count
      FROM admin_notifications
      WHERE is_read = false
    `

    return NextResponse.json({
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        metadata: n.metadata,
        is_read: n.is_read,
        created_at: n.created_at
      })),
      unread_count: parseInt(String(countResult?.count || 0), 10)
    })
  } catch (error) {
    console.error('[Admin Notifications] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}
