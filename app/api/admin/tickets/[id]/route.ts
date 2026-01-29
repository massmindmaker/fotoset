/**
 * GET /api/admin/tickets/[id]
 * Get single ticket by ID with messages
 *
 * PATCH /api/admin/tickets/[id]
 * Update ticket fields (status, priority, category, assigned_to)
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/admin/session'
import { getTicketById, getTicketMessages, updateTicketStatus } from '@/lib/support'
import { query } from '@/lib/db'
import { logAdminAction } from '@/lib/admin/audit'
import type { TicketStatus, TicketPriority, TicketCategory } from '@/lib/support/types'

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

    // Get ticket
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
    const messages = await getTicketMessages(ticketId, 100)

    return NextResponse.json({
      success: true,
      data: {
        ticket,
        messages,
        messages_count: messages.length,
        last_message_at: messages.length > 0 ? messages[messages.length - 1].created_at : null
      }
    })
  } catch (error) {
    console.error('[Admin API] Error fetching ticket:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          userMessage: 'Ошибка загрузки тикета',
          devMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, context: Params) {
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

    // Get ticket to verify it exists
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
    const { status, priority, category, assigned_to } = body as {
      status?: TicketStatus
      priority?: TicketPriority
      category?: TicketCategory
      assigned_to?: string | null
    }

    // Build update fields
    const updates: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      params.push(status)
    }

    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`)
      params.push(priority)
    }

    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`)
      params.push(category)
    }

    if (assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`)
      params.push(assigned_to)

      if (assigned_to) {
        updates.push(`assigned_at = NOW()`)
      }
    }

    // Add updated_at
    updates.push('updated_at = NOW()')

    if (updates.length === 1) {
      // Only updated_at, nothing to update
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_CHANGES',
            userMessage: 'Нет изменений для сохранения'
          }
        },
        { status: 400 }
      )
    }

    // Update ticket
    params.push(ticketId)
    await query(
      `UPDATE support_tickets
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}`,
      params
    )

    // Log admin action
    await logAdminAction({
      adminId: session.adminId,
      action: 'ticket_updated',
      targetId: ticketId,
      metadata: {
        ticket_number: ticket.ticket_number,
        changes: { status, priority, category, assigned_to }
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
    console.error('[Admin API] Error updating ticket:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          userMessage: 'Ошибка обновления тикета',
          devMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 500 }
    )
  }
}
