/**
 * POST /api/admin/telegram/[id]/retry
 * Retry a failed telegram message
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
import { logAdminAction } from '@/lib/admin/audit'
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
    const messageId = parseInt(id, 10)

    if (isNaN(messageId)) {
      return NextResponse.json({ error: 'Invalid message ID' }, { status: 400 })
    }
    // Get message
    const [message] = await sql`
      SELECT * FROM telegram_message_queue
      WHERE id = ${messageId}
    `

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    if (message.status !== 'failed') {
      return NextResponse.json(
        { error: `Cannot retry message with status: ${message.status}` },
        { status: 400 }
      )
    }

    // Check retry count limit (max 5 retries)
    const MAX_RETRIES = 5
    if (message.retry_count >= MAX_RETRIES) {
      return NextResponse.json(
        { error: `Maximum retry count (${MAX_RETRIES}) exceeded for this message` },
        { status: 400 }
      )
    }

    // Reset message to pending for retry
    await sql`
      UPDATE telegram_message_queue
      SET
        status = 'pending',
        retry_count = retry_count + 1,
        error_message = NULL
      WHERE id = ${messageId}
    `

    // Log action
    await logAdminAction({
      adminId: session.adminId,
      action: 'telegram_message_retried',
      targetId: messageId,
      metadata: {
        user_id: message.user_id,
        message_type: message.message_type,
        previous_retry_count: message.retry_count
      }
    })

    return NextResponse.json({
      success: true,
      messageId
    })
  } catch (error) {
    console.error('[Admin Telegram Retry] Error:', error)
    return NextResponse.json(
      { error: 'Failed to retry message' },
      { status: 500 }
    )
  }
}
