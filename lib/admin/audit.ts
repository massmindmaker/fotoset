/**
 * Admin Activity Audit Log
 *
 * Logs all admin panel operations for security compliance and audit trails.
 * Supports both new session-based auth and legacy Telegram auth.
 */

import { neon } from '@neondatabase/serverless'

export type AuditTargetType =
  | 'user'
  | 'payment'
  | 'avatar'
  | 'generation'
  | 'referral'
  | 'withdrawal'
  | 'setting'
  | 'admin'
  | 'experiment'

export type AuditAction =
  // Auth actions
  | 'login'
  | 'logout'
  | 'login_failed'
  // User actions
  | 'user_viewed'
  | 'user_banned'
  | 'user_unbanned'
  | 'user_granted_pro'
  | 'user_revoked_pro'
  | 'user_message_sent'
  | 'user_regeneration_triggered'
  // Payment actions
  | 'payment_viewed'
  | 'payment_refunded'
  | 'payments_exported'
  // Export actions
  | 'data_exported'
  // Legacy payment actions
  | 'REFUND_CREATED'
  | 'PAYMENT_VIEWED'
  | 'USER_VIEWED'
  | 'LOGS_VIEWED'
  | 'STATS_VIEWED'
  // Generation actions
  | 'generation_viewed'
  | 'generation_retried'
  | 'generation_triggered'
  // Referral actions
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'withdrawal_processing_manual'
  // Telegram actions
  | 'telegram_message_retried'
  | 'telegram_test_sent'
  | 'broadcast_created'
  // Settings actions
  | 'settings_updated'
  | 'pricing_updated'
  | 'feature_flag_toggled'
  | 'maintenance_mode_changed'
  // Admin management
  | 'admin_created'
  | 'admin_updated'
  | 'admin_deleted'
  | 'admin_role_changed'
  // Experiments
  | 'experiment_created'
  | 'experiment_started'
  | 'experiment_stopped'
  | 'experiment_updated'
  // Ticket actions
  | 'ticket_assigned'
  | 'ticket_resolved'
  | 'ticket_status_changed'
  | 'ticket_updated'
  | 'ticket_message_sent'

export interface AuditLogEntry {
  adminId: number
  action: AuditAction
  targetType?: AuditTargetType
  targetId?: number
  metadata?: Record<string, unknown>
  ipAddress?: string
}

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

/**
 * Log an admin action to the audit trail
 *
 * @param entry - Audit log entry object
 *
 * @example
 * await logAdminAction({
 *   adminId: 1,
 *   action: 'payment_refunded',
 *   targetType: 'payment',
 *   targetId: 123,
 *   metadata: { amount: 499, reason: 'Failed generation' }
 * })
 */
export async function logAdminAction(entry: AuditLogEntry): Promise<void> {
  const sql = getSql()

  try {
    await sql`
      INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, metadata, ip_address)
      VALUES (
        ${entry.adminId},
        ${entry.action},
        ${entry.targetType || null},
        ${entry.targetId || null},
        ${entry.metadata ? JSON.stringify(entry.metadata) : null},
        ${entry.ipAddress || null}
      )
    `
    console.log(`[Audit] ${entry.action} by admin ${entry.adminId}`)
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error("[Audit] Failed to log admin action:", error)
  }
}

/**
 * Get recent activity log
 */
export async function getRecentActivity(
  limit: number = 50,
  offset: number = 0,
  filters?: {
    adminId?: number
    action?: AuditAction
    targetType?: AuditTargetType
    targetId?: number
    dateFrom?: Date
    dateTo?: Date
  }
): Promise<{
  entries: Array<{
    id: number
    adminId: number
    adminEmail: string
    adminName: string
    action: AuditAction
    targetType: AuditTargetType | null
    targetId: number | null
    metadata: Record<string, unknown> | null
    ipAddress: string | null
    createdAt: Date
  }>
  total: number
}> {
  const sql = getSql()

  // For simple case, use parameterized query
  const entries = await sql`
    SELECT
      l.id,
      l.admin_id,
      a.email as admin_email,
      COALESCE(a.first_name || ' ' || a.last_name, a.email) as admin_name,
      l.action,
      l.target_type,
      l.target_id,
      l.metadata,
      l.ip_address,
      l.created_at
    FROM admin_activity_log l
    LEFT JOIN admin_users a ON l.admin_id = a.id
    ORDER BY l.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `

  const [countResult] = await sql`
    SELECT COUNT(*) as total FROM admin_activity_log
  `

  return {
    entries: entries.map(e => ({
      id: e.id,
      adminId: e.admin_id,
      adminEmail: e.admin_email || 'unknown',
      adminName: e.admin_name || 'Unknown',
      action: e.action as AuditAction,
      targetType: e.target_type as AuditTargetType | null,
      targetId: e.target_id,
      metadata: e.metadata as Record<string, unknown> | null,
      ipAddress: e.ip_address,
      createdAt: new Date(e.created_at)
    })),
    total: parseInt(countResult.total, 10)
  }
}

/**
 * Get action display name
 */
export function getActionDisplayName(action: AuditAction): string {
  const names: Record<string, string> = {
    login: 'Вход в систему',
    logout: 'Выход из системы',
    login_failed: 'Неудачная попытка входа',
    user_viewed: 'Просмотр пользователя',
    user_banned: 'Блокировка пользователя',
    user_unbanned: 'Разблокировка пользователя',
    user_granted_pro: 'Выдача Pro статуса',
    user_revoked_pro: 'Отзыв Pro статуса',
    user_message_sent: 'Отправка сообщения',
    user_regeneration_triggered: 'Запуск регенерации',
    payment_viewed: 'Просмотр платежа',
    payment_refunded: 'Возврат платежа',
    payments_exported: 'Экспорт платежей',
    data_exported: 'Экспорт данных',
    REFUND_CREATED: 'Возврат создан',
    PAYMENT_VIEWED: 'Платёж просмотрен',
    USER_VIEWED: 'Пользователь просмотрен',
    LOGS_VIEWED: 'Логи просмотрены',
    STATS_VIEWED: 'Статистика просмотрена',
    generation_viewed: 'Просмотр генерации',
    generation_retried: 'Повтор генерации',
    generation_triggered: 'Запуск генерации',
    withdrawal_approved: 'Одобрение выплаты',
    withdrawal_rejected: 'Отклонение выплаты',
    telegram_message_retried: 'Повтор TG сообщения',
    telegram_test_sent: 'Тестовое TG сообщение',
    settings_updated: 'Обновление настроек',
    pricing_updated: 'Обновление тарифов',
    feature_flag_toggled: 'Переключение функции',
    maintenance_mode_changed: 'Изменение режима обслуживания',
    admin_created: 'Создание администратора',
    admin_updated: 'Обновление администратора',
    admin_deleted: 'Удаление администратора',
    admin_role_changed: 'Изменение роли',
    experiment_created: 'Создание эксперимента',
    experiment_started: 'Запуск эксперимента',
    experiment_stopped: 'Остановка эксперимента',
    experiment_updated: 'Обновление эксперимента'
  }
  return names[action] || action
}
