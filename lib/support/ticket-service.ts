// Ticket Management Service

import { query } from '@/lib/db'
import {
  SupportTicket,
  TicketMessage,
  TicketPriority,
  TicketCategory,
  TicketStatus,
  SLAConfig,
  PRIORITY_KEYWORDS,
  CATEGORY_KEYWORDS,
} from './types'

/**
 * Detect priority based on message content
 */
export function detectPriority(text: string): TicketPriority {
  const lowerText = text.toLowerCase()

  for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return priority as TicketPriority
      }
    }
  }

  return 'P3' // Default medium priority
}

/**
 * Detect category based on message content
 */
export function detectCategory(text: string): TicketCategory {
  const lowerText = text.toLowerCase()

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'general') continue // Skip general, it's the fallback

    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return category as TicketCategory
      }
    }
  }

  return 'general'
}

/**
 * Get SLA configuration for a priority
 */
async function getSLAConfig(priority: TicketPriority): Promise<SLAConfig | null> {
  const result = await query<SLAConfig>(
    `SELECT * FROM support_sla_config WHERE priority = $1 AND is_active = TRUE`,
    [priority]
  )
  return result.rows[0] || null
}

/**
 * Calculate SLA deadlines based on priority
 */
async function calculateSLADeadlines(
  priority: TicketPriority
): Promise<{ firstResponse: Date; resolution: Date }> {
  const sla = await getSLAConfig(priority)

  const now = new Date()

  // Default values if SLA config not found
  const firstResponseMinutes = sla?.first_response_minutes || 240
  const resolutionMinutes = sla?.resolution_minutes || 1440

  return {
    firstResponse: new Date(now.getTime() + firstResponseMinutes * 60 * 1000),
    resolution: new Date(now.getTime() + resolutionMinutes * 60 * 1000),
  }
}

/**
 * Create a new support ticket
 */
export async function createTicket(params: {
  telegramChatId: number
  telegramUsername?: string
  userName?: string
  userId?: number
  subject?: string
  initialMessage: string
}): Promise<SupportTicket> {
  const priority = detectPriority(params.initialMessage)
  const category = detectCategory(params.initialMessage)
  const slaDeadlines = await calculateSLADeadlines(priority)

  // Generate ticket number
  const ticketNumberResult = await query<{ ticket_number: string }>(
    `SELECT generate_ticket_number() as ticket_number`
  )
  const ticketNumber = ticketNumberResult.rows[0]?.ticket_number || `TKT-${Date.now()}`

  // Create ticket
  const ticketResult = await query<SupportTicket>(
    `INSERT INTO support_tickets (
      ticket_number, user_id, telegram_chat_id, telegram_username, user_name,
      subject, category, priority, status,
      sla_first_response_at, sla_resolution_at, source
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9, $10, 'telegram')
    RETURNING *`,
    [
      ticketNumber,
      params.userId || null,
      params.telegramChatId,
      params.telegramUsername || null,
      params.userName || null,
      params.subject || null,
      category,
      priority,
      slaDeadlines.firstResponse.toISOString(),
      slaDeadlines.resolution.toISOString(),
    ]
  )

  const ticket = ticketResult.rows[0]

  // Add initial message
  await addMessage({
    ticketId: ticket.id,
    senderType: 'user',
    senderId: String(params.telegramChatId),
    senderName: params.userName,
    message: params.initialMessage,
  })

  console.log(`[Ticket] Created ${ticketNumber} - ${priority} - ${category}`)

  return ticket
}

/**
 * Get open ticket for a user
 */
export async function getOpenTicket(telegramChatId: number): Promise<SupportTicket | null> {
  const result = await query<SupportTicket>(
    `SELECT * FROM support_tickets
     WHERE telegram_chat_id = $1 AND status NOT IN ('closed', 'resolved')
     ORDER BY created_at DESC LIMIT 1`,
    [telegramChatId]
  )
  return result.rows[0] || null
}

/**
 * Get ticket by number
 */
export async function getTicketByNumber(ticketNumber: string): Promise<SupportTicket | null> {
  const result = await query<SupportTicket>(
    `SELECT * FROM support_tickets WHERE ticket_number = $1`,
    [ticketNumber]
  )
  return result.rows[0] || null
}

/**
 * Get ticket by ID
 */
export async function getTicketById(ticketId: number): Promise<SupportTicket | null> {
  const result = await query<SupportTicket>(`SELECT * FROM support_tickets WHERE id = $1`, [
    ticketId,
  ])
  return result.rows[0] || null
}

/**
 * Add message to ticket
 */
export async function addMessage(params: {
  ticketId: number
  senderType: 'user' | 'operator' | 'system' | 'ai'
  senderId?: string
  senderName?: string
  message: string
  messageType?: 'text' | 'photo' | 'document' | 'system_note'
  attachments?: { type: string; url: string; filename?: string }[]
  aiSuggestedResponse?: string
  aiConfidence?: number
  telegramMessageId?: number
}): Promise<TicketMessage> {
  const result = await query<TicketMessage>(
    `INSERT INTO support_ticket_messages (
      ticket_id, sender_type, sender_id, sender_name, message, message_type,
      attachments, ai_suggested_response, ai_confidence, telegram_message_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      params.ticketId,
      params.senderType,
      params.senderId || null,
      params.senderName || null,
      params.message,
      params.messageType || 'text',
      params.attachments ? JSON.stringify(params.attachments) : null,
      params.aiSuggestedResponse || null,
      params.aiConfidence || null,
      params.telegramMessageId || null,
    ]
  )

  // Update ticket timestamp
  await query(`UPDATE support_tickets SET updated_at = NOW() WHERE id = $1`, [params.ticketId])

  // If operator responded and first_responded_at is null, set it
  if (params.senderType === 'operator') {
    await query(
      `UPDATE support_tickets
       SET first_responded_at = COALESCE(first_responded_at, NOW()),
           status = 'in_progress'
       WHERE id = $1`,
      [params.ticketId]
    )
  }

  return result.rows[0]
}

/**
 * Get ticket messages
 */
export async function getTicketMessages(
  ticketId: number,
  limit: number = 50
): Promise<TicketMessage[]> {
  const result = await query<TicketMessage>(
    `SELECT * FROM support_ticket_messages
     WHERE ticket_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [ticketId, limit]
  )
  return result.rows
}

/**
 * Update ticket status
 */
export async function updateTicketStatus(
  ticketId: number,
  status: TicketStatus,
  operatorUsername?: string
): Promise<void> {
  let additionalFields = ''

  if (status === 'resolved') {
    additionalFields = ', resolved_at = NOW()'
  } else if (status === 'closed') {
    additionalFields = ', closed_at = NOW()'
  } else if (status === 'in_progress' && operatorUsername) {
    additionalFields = ', assigned_to = $3, assigned_at = NOW()'
  }

  if (status === 'in_progress' && operatorUsername) {
    await query(
      `UPDATE support_tickets SET status = $1${additionalFields} WHERE id = $2`,
      [status, ticketId, operatorUsername]
    )
  } else {
    await query(`UPDATE support_tickets SET status = $1${additionalFields} WHERE id = $2`, [
      status,
      ticketId,
    ])
  }
}

/**
 * Assign ticket to operator
 */
export async function assignTicket(ticketId: number, operatorUsername: string): Promise<void> {
  await query(
    `UPDATE support_tickets
     SET assigned_to = $1, assigned_at = NOW(), status = 'in_progress'
     WHERE id = $2`,
    [operatorUsername, ticketId]
  )
}

/**
 * Escalate ticket
 */
export async function escalateTicket(ticketId: number, reason: string): Promise<void> {
  await query(
    `UPDATE support_tickets
     SET escalated = TRUE, escalated_at = NOW(), escalation_reason = $1
     WHERE id = $2`,
    [reason, ticketId]
  )
}

/**
 * Get tickets requiring attention (for admin)
 */
export async function getTicketsRequiringAttention(): Promise<SupportTicket[]> {
  const result = await query<SupportTicket>(
    `SELECT * FROM support_tickets
     WHERE status IN ('open', 'in_progress')
     AND (
       sla_first_response_at < NOW() + INTERVAL '30 minutes'
       OR escalated = TRUE
     )
     ORDER BY
       CASE priority
         WHEN 'P1' THEN 1
         WHEN 'P2' THEN 2
         WHEN 'P3' THEN 3
         WHEN 'P4' THEN 4
       END,
       created_at ASC`
  )
  return result.rows
}

/**
 * Get ticket statistics
 */
export async function getTicketStats(): Promise<{
  total: number
  open: number
  inProgress: number
  waitingUser: number
  resolved: number
  closed: number
  slaBreached: number
  avgResponseMinutes: number
}> {
  const result = await query<{
    total: string
    open: string
    in_progress: string
    waiting_user: string
    resolved: string
    closed: string
    sla_breached: string
    avg_response_minutes: string
  }>(
    `SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'open') as open,
      COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
      COUNT(*) FILTER (WHERE status = 'waiting_user') as waiting_user,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
      COUNT(*) FILTER (WHERE status = 'closed') as closed,
      COUNT(*) FILTER (WHERE status = 'open' AND sla_first_response_at < NOW()) as sla_breached,
      COALESCE(
        AVG(EXTRACT(EPOCH FROM (first_responded_at - created_at)) / 60)
        FILTER (WHERE first_responded_at IS NOT NULL),
        0
      ) as avg_response_minutes
     FROM support_tickets
     WHERE created_at > NOW() - INTERVAL '30 days'`
  )

  const row = result.rows[0]
  return {
    total: parseInt(row.total) || 0,
    open: parseInt(row.open) || 0,
    inProgress: parseInt(row.in_progress) || 0,
    waitingUser: parseInt(row.waiting_user) || 0,
    resolved: parseInt(row.resolved) || 0,
    closed: parseInt(row.closed) || 0,
    slaBreached: parseInt(row.sla_breached) || 0,
    avgResponseMinutes: Math.round(parseFloat(row.avg_response_minutes) || 0),
  }
}

/**
 * Close ticket by user request
 */
export async function closeTicketByUser(telegramChatId: number): Promise<SupportTicket | null> {
  const ticket = await getOpenTicket(telegramChatId)

  if (!ticket) return null

  await updateTicketStatus(ticket.id, 'closed')

  // Add system message
  await addMessage({
    ticketId: ticket.id,
    senderType: 'system',
    message: 'Тикет закрыт пользователем',
  })

  return getTicketById(ticket.id)
}

/**
 * Get all tickets for admin panel with pagination
 */
export async function getTicketsForAdmin(params: {
  page?: number
  limit?: number
  status?: string
  priority?: string
  category?: string
  search?: string
  assignedTo?: string
}): Promise<{ tickets: SupportTicket[]; total: number }> {
  const page = params.page || 1
  const limit = params.limit || 20
  const offset = (page - 1) * limit

  let whereClause = 'WHERE 1=1'
  const queryParams: any[] = []
  let paramIndex = 1

  if (params.status && params.status !== 'all') {
    whereClause += ` AND status = $${paramIndex++}`
    queryParams.push(params.status)
  }

  if (params.priority && params.priority !== 'all') {
    whereClause += ` AND priority = $${paramIndex++}`
    queryParams.push(params.priority)
  }

  if (params.category && params.category !== 'all') {
    whereClause += ` AND category = $${paramIndex++}`
    queryParams.push(params.category)
  }

  if (params.assignedTo) {
    whereClause += ` AND assigned_to = $${paramIndex++}`
    queryParams.push(params.assignedTo)
  }

  if (params.search) {
    whereClause += ` AND (
      ticket_number ILIKE $${paramIndex} OR
      user_name ILIKE $${paramIndex} OR
      telegram_username ILIKE $${paramIndex} OR
      subject ILIKE $${paramIndex}
    )`
    queryParams.push(`%${params.search}%`)
    paramIndex++
  }

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM support_tickets ${whereClause}`,
    queryParams
  )
  const total = parseInt(countResult.rows[0]?.count || '0')

  // Get tickets with computed fields
  const ticketsResult = await query<SupportTicket & {
    telegram_user_id: string
    messages_count: number
    last_message_at: string | null
    assigned_to_name: string | null
    sla_deadline: string | null
  }>(
    `SELECT
       t.*,
       t.telegram_chat_id::text as telegram_user_id,
       t.sla_first_response_at as sla_deadline,
       COALESCE((SELECT COUNT(*) FROM support_ticket_messages WHERE ticket_id = t.id), 0)::int as messages_count,
       (SELECT MAX(created_at) FROM support_ticket_messages WHERE ticket_id = t.id) as last_message_at,
       (SELECT admin_username FROM support_operators WHERE admin_username = t.assigned_to LIMIT 1) as assigned_to_name
     FROM support_tickets t
     ${whereClause}
     ORDER BY
       CASE
         WHEN t.status = 'open' AND t.sla_first_response_at < NOW() THEN 0
         WHEN t.status = 'open' THEN 1
         WHEN t.status = 'in_progress' THEN 2
         ELSE 3
       END,
       CASE t.priority
         WHEN 'P1' THEN 1
         WHEN 'P2' THEN 2
         WHEN 'P3' THEN 3
         WHEN 'P4' THEN 4
       END,
       t.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...queryParams, limit, offset]
  )

  return {
    tickets: ticketsResult.rows,
    total,
  }
}
