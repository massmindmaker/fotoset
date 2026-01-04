// Support Ticket System Types

export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4'
export type TicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed'
export type TicketCategory = 'payment' | 'generation' | 'technical' | 'account' | 'feedback' | 'general'
export type MessageSenderType = 'user' | 'operator' | 'system' | 'ai'

export interface SupportTicket {
  id: number
  ticket_number: string

  // User info
  user_id: number | null
  telegram_chat_id: number
  telegram_username: string | null
  user_name: string | null

  // Ticket details
  subject: string | null
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus

  // SLA tracking
  sla_first_response_at: string | null
  sla_resolution_at: string | null
  first_responded_at: string | null
  resolved_at: string | null
  closed_at: string | null

  // Assignment
  assigned_to: string | null
  assigned_at: string | null

  // Escalation
  escalated: boolean
  escalated_at: string | null
  escalation_reason: string | null

  // Metadata
  source: 'telegram' | 'webapp' | 'admin'
  tags: string[] | null

  created_at: string
  updated_at: string
}

export interface TicketMessage {
  id: number
  ticket_id: number

  // Sender info
  sender_type: MessageSenderType
  sender_id: string | null
  sender_name: string | null

  // Message content
  message: string
  message_type: 'text' | 'photo' | 'document' | 'system_note'
  attachments: { type: string; url: string; filename?: string }[] | null

  // AI assistance
  ai_suggested_response: string | null
  ai_confidence: number | null

  // Telegram
  telegram_message_id: number | null

  created_at: string
}

export interface SLAConfig {
  id: number
  priority: TicketPriority
  first_response_minutes: number
  resolution_minutes: number
  escalation_after_minutes: number | null
  escalate_to: string | null
  description: string | null
  examples: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SupportOperator {
  id: number
  admin_username: string
  telegram_user_id: number | null
  is_active: boolean
  can_assign: boolean
  can_close: boolean
  max_open_tickets: number
  tickets_resolved: number
  avg_response_time_minutes: number | null
  avg_resolution_time_minutes: number | null
  satisfaction_rating: number | null
  is_online: boolean
  last_activity_at: string | null
  created_at: string
  updated_at: string
}

export interface CannedResponse {
  id: number
  shortcut: string
  title: string
  content: string
  category: string | null
  use_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FAQItem {
  id: string
  category: string
  keywords: string[]
  question: string
  answer: string
}

export interface FAQCategory {
  id: string
  emoji: string
  title: string
  description: string
}

// API response types
export interface TicketWithMessages extends SupportTicket {
  messages: TicketMessage[]
  messages_count: number
  last_message_at: string | null
}

export interface TicketStats {
  total: number
  open: number
  in_progress: number
  waiting_user: number
  resolved: number
  closed: number

  // SLA stats
  sla_breached: number
  sla_at_risk: number // within 30 min of breach

  // By priority
  by_priority: {
    P1: number
    P2: number
    P3: number
    P4: number
  }

  // Average times
  avg_first_response_minutes: number
  avg_resolution_minutes: number
}

// Priority detection keywords
export const PRIORITY_KEYWORDS: Record<TicketPriority, string[]> = {
  P1: [
    'деньги списались', 'оплата не прошла', 'двойное списание',
    'возврат', 'срочно', 'украли', 'мошенники', 'не вернули деньги',
    'деньги ушли', 'списали дважды', 'ошибка оплаты'
  ],
  P2: [
    'генерация не работает', 'фото не появились', 'ошибка генерации',
    'не генерируется', 'зависло', 'не загружается', 'долго генерирует',
    'результат не пришёл', 'плохое качество'
  ],
  P3: [
    'как скачать', 'как работает', 'тариф', 'цена', 'сколько стоит',
    'как оплатить', 'какие фото', 'сколько фото', 'формат'
  ],
  P4: [
    'предложение', 'пожелание', 'отзыв', 'спасибо', 'классно',
    'хотелось бы', 'было бы неплохо', 'идея'
  ]
}

// Category detection keywords
export const CATEGORY_KEYWORDS: Record<TicketCategory, string[]> = {
  payment: [
    'оплата', 'платёж', 'деньги', 'карта', 'списали', 'возврат',
    'рубли', 'тариф', 'подписка', 'цена', 'стоимость', 'сбп'
  ],
  generation: [
    'генерация', 'фото', 'портрет', 'результат', 'качество',
    'загрузка', 'обработка', 'нейросеть', 'ai', 'ии'
  ],
  technical: [
    'ошибка', 'баг', 'не работает', 'глюк', 'зависло',
    'не загружается', 'белый экран', 'приложение'
  ],
  account: [
    'аккаунт', 'профиль', 'вход', 'telegram', 'привязка',
    'устройство', 'перенести', 'данные'
  ],
  feedback: [
    'отзыв', 'предложение', 'пожелание', 'идея', 'спасибо',
    'классно', 'круто', 'здорово'
  ],
  general: []
}
