/**
 * POST /api/admin/notifications/read-all
 * Mark all notifications as read
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = getSql()

    // Mark all as read
    const result = await sql`
      UPDATE admin_notifications
      SET is_read = true
      WHERE is_read = false
    `

    return NextResponse.json({
      success: true,
      marked_count: result.length || 0
    })
  } catch (error) {
    console.error('[Admin Notifications Mark All Read] Error:', error)
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    )
  }
}
