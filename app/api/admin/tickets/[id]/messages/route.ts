/**
 * GET /api/admin/tickets/[id]/messages
 * Get all messages for a ticket
 *
 * POST /api/admin/tickets/[id]/messages
 * Add operator response message and send notification to user via Telegram
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/admin/session'
import { getTicketById, getTicketMessages, addMessage } from '@/lib/support'
import { logAdminAction } from '@/lib/admin/audit'
import { sendTextNotification } from '@/lib/telegram-notify'

type Params = {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, context: Params) {
  try {
    // Validate admin session
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            userMessage: 'Необходима авторизация'
          }
        },
        { status: 401 }
      )
    }

    const { id } = await context.params
    const ticketId = parseInt(id, 10)

    if (isNaN(ticketId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            userMessage: 'Некорректный ID тикета'
          }
        },
        { status: 400 }
      )
    }

    // Verify ticket exists
    const ticket = await getTicketById(ticketId)
    if (!ticket) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            userMessage: 'Тикет не найден'
          }
        },
        { status: 404 }
      )
    }

    // Get messages
    const { searchParams } = request.nextUrl
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)))
    const messages = await getTicketMessages(ticketId, limit)

    return NextResponse.json({
      success: true,
      data: {
        messages,
        total: messages.length
      }
    })
  } catch (error) {
    console.error('[Admin API] Error fetching ticket messages:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          userMessage: 'Ошибка загрузки сообщений',
          devMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, context: Params) {
  try {
    // Validate admin session
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            userMessage: 'Необходима авторизация'
          }
        },
        { status: 401 }
      )
    }

    const { id } = await context.params
    const ticketId = parseInt(id, 10)

    if (isNaN(ticketId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            userMessage: 'Некорректный ID тикета'
          }
        },
        { status: 400 }
      )
    }

    // Verify ticket exists
    const ticket = await getTicketById(ticketId)
    if (!ticket) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            userMessage: 'Тикет не найден'
          }
        },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { message, messageType = 'text' } = body as {
      message: string
      messageType?: 'text' | 'system_note'
    }

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_MESSAGE',
            userMessage: 'Сообщение не может быть пустым'
          }
        },
        { status: 400 }
      )
    }

    // Add operator message
    const newMessage = await addMessage({
      ticketId,
      senderType: 'operator',
      senderId: String(session.adminId),
      senderName: session.firstName && session.lastName
        ? `${session.firstName} ${session.lastName}`
        : session.email,
      message: message.trim(),
      messageType
    })

    // Log admin action
    await logAdminAction({
      adminId: session.adminId,
      action: 'ticket_message_sent',
      targetId: ticketId,
      metadata: {
        ticket_number: ticket.ticket_number,
        message_id: newMessage.id,
        message_preview: message.substring(0, 100)
      }
    })

    // Send Telegram notification to user (only for text messages, not system notes)
    if (messageType === 'text' && ticket.telegram_chat_id) {
      try {
        const notificationText =
          `📨 <b>Новое сообщение по тикету ${ticket.ticket_number}</b>\n\n` +
          `${message.trim()}\n\n` +
          `<i>Вы можете ответить, отправив сообщение в этот чат.</i>`

        await sendTextNotification(ticket.telegram_chat_id, notificationText)
        console.log(`[Ticket] Telegram notification sent for ticket ${ticket.ticket_number}`)
      } catch (notificationError) {
        console.error('[Ticket] Failed to send Telegram notification:', notificationError)
        // Don't fail the request if notification fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: newMessage
      }
    })
  } catch (error) {
    console.error('[Admin API] Error adding ticket message:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CREATE_ERROR',
          userMessage: 'Ошибка отправки сообщения',
          devMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 500 }
    )
  }
}
