/**
 * POST /api/admin/telegram/send
 * Send a test message to a user via Telegram
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60


import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
import { logAdminAction } from '@/lib/admin/audit'
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SECURITY: Only super_admin and admin can send messages
    if (session.role !== 'super_admin' && session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { telegramUserId, message, messageType = 'admin_notification' } = body as {
      telegramUserId: string
      message: string
      messageType?: string
    }

    if (!telegramUserId || !message) {
      return NextResponse.json(
        { error: 'telegramUserId and message are required' },
        { status: 400 }
      )
    }
    // Find user by telegram_user_id
    const [user] = await sql`
      SELECT id FROM users
      WHERE telegram_user_id = ${telegramUserId}
    `

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if telegram_message_queue table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'telegram_message_queue'
      ) as exists
    `

    if (!tableCheck[0]?.exists) {
      // Create table if it doesn't exist
      await sql`
        CREATE TABLE IF NOT EXISTS telegram_message_queue (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          message_type VARCHAR(50),
          payload JSONB,
          status VARCHAR(20) DEFAULT 'pending',
          retry_count INTEGER DEFAULT 0,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          sent_at TIMESTAMP
        )
      `
    }

    // Add message to queue
    const [newMessage] = await sql`
      INSERT INTO telegram_message_queue (user_id, message_type, payload, status)
      VALUES (${user.id}, ${messageType}, ${JSON.stringify({ text: message })}, 'pending')
      RETURNING id
    `

    // Log action
    await logAdminAction({
      adminId: session.adminId,
      action: 'telegram_test_sent',
      targetId: newMessage.id,
      metadata: {
        user_id: user.id,
        telegram_user_id: telegramUserId,
        message_type: messageType,
        message_preview: message.substring(0, 100)
      }
    })

    return NextResponse.json({
      success: true,
      messageId: newMessage.id
    })
  } catch (error) {
    console.error('[Admin Telegram Send] Error:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
