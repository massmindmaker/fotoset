import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/admin/session'
import { query } from '@/lib/db'
import { escalateTicket, getTicketById, addMessage } from '@/lib/support'

type RouteParams = Promise<{ id: string }>

/**
 * POST /api/admin/tickets/[id]/escalate
 * Escalate a ticket - increases priority and marks as escalated
 */
export async function POST(
  request: NextRequest,
  { params }: { params: RouteParams }
): Promise<NextResponse> {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const ticketId = parseInt(id)

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: 'Invalid ticket ID' }, { status: 400 })
    }

    // Get current ticket
    const ticket = await getTicketById(ticketId)
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Check if already escalated
    if (ticket.escalated) {
      return NextResponse.json(
        { error: 'Ticket is already escalated' },
        { status: 400 }
      )
    }

    // Determine new priority (escalate by one level)
    const priorityMap: Record<string, string> = {
      P4: 'P3',
      P3: 'P2',
      P2: 'P1',
      P1: 'P1', // Already highest
    }
    const newPriority = priorityMap[ticket.priority] || 'P2'

    // Update ticket - escalate and increase priority
    await query(
      `UPDATE support_tickets
       SET priority = $1,
           escalated = TRUE,
           escalated_at = NOW(),
           escalation_reason = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [newPriority, `Escalated by ${session.email}`, ticketId]
    )

    // Add system message about escalation
    await addMessage({
      ticketId,
      senderType: 'system',
      message: `Тикет эскалирован оператором ${session.email}. Приоритет изменён: ${ticket.priority} → ${newPriority}`,
    })

    // Get updated ticket
    const updatedTicket = await getTicketById(ticketId)

    // Log audit event
    await query(
      `INSERT INTO audit_log (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        session.adminId,
        'ticket_escalated',
        'support_ticket',
        ticketId,
        JSON.stringify({
          old_priority: ticket.priority,
          new_priority: newPriority,
          ticket_number: ticket.ticket_number,
        }),
      ]
    )

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
      message: `Ticket escalated from ${ticket.priority} to ${newPriority}`,
    })
  } catch (error) {
    console.error('[Admin Tickets] Escalate error:', error)
    return NextResponse.json(
      { error: 'Failed to escalate ticket' },
      { status: 500 }
    )
  }
}
