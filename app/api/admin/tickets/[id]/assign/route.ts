/**
 * POST /api/admin/tickets/[id]/assign
 * Assign ticket to an operator
 *
 * Body:
 * - operatorUsername: string (admin username to assign to)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/admin/session'
import { getTicketById, assignTicket, addMessage } from '@/lib/support'
import { logAdminAction } from '@/lib/admin/audit'

type Params = {
  params: Promise<{
    id: string
  }>
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
    const { operatorUsername } = body as {
      operatorUsername: string
    }

    if (!operatorUsername || operatorUsername.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_OPERATOR',
            userMessage: 'Имя оператора не может быть пустым'
          }
        },
        { status: 400 }
      )
    }

    // Assign ticket
    await assignTicket(ticketId, operatorUsername.trim())

    // Add system message
    await addMessage({
      ticketId,
      senderType: 'system',
      message: `Тикет назначен оператору ${operatorUsername.trim()}`,
      messageType: 'system_note'
    })

    // Log admin action
    await logAdminAction({
      adminId: session.adminId,
      action: 'ticket_assigned',
      targetId: ticketId,
      metadata: {
        ticket_number: ticket.ticket_number,
        operator_username: operatorUsername.trim(),
        previous_assignee: ticket.assigned_to
      }
    })

    // Get updated ticket
    const updatedTicket = await getTicketById(ticketId)

    return NextResponse.json({
      success: true,
      data: {
        ticket: updatedTicket
      }
    })
  } catch (error) {
    console.error('[Admin API] Error assigning ticket:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ASSIGN_ERROR',
          userMessage: 'Ошибка назначения тикета',
          devMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 500 }
    )
  }
}
