/**
 * Admin Notifications Helper
 *
 * Functions for creating and managing admin notifications
 */

import { neon } from '@neondatabase/serverless'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface CreateNotificationParams {
  type: NotificationType
  title: string
  message?: string
  metadata?: Record<string, unknown>
}

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

/**
 * Create a new admin notification
 *
 * @example
 * await createNotification({
 *   type: 'warning',
 *   title: 'Высокий процент отказов',
 *   message: 'Процент отказов генераций превысил 10%',
 *   metadata: { failure_rate: 12.5 }
 * })
 */
export async function createNotification(params: CreateNotificationParams): Promise<number | null> {
  const sql = getSql()

  try {
    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        metadata JSONB,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `

    const [result] = await sql`
      INSERT INTO admin_notifications (type, title, message, metadata)
      VALUES (
        ${params.type},
        ${params.title},
        ${params.message || null},
        ${params.metadata ? JSON.stringify(params.metadata) : null}
      )
      RETURNING id
    `

    console.log(`[Notifications] Created: ${params.title}`)
    return result?.id || null
  } catch (error) {
    console.error('[Notifications] Failed to create notification:', error)
    return null
  }
}

/**
 * Create notification for failed payment
 */
export async function notifyPaymentFailed(paymentId: number, amount: number, reason: string) {
  return createNotification({
    type: 'error',
    title: 'Платёж не удался',
    message: `Платёж #${paymentId} на сумму ${amount}₽ не прошёл`,
    metadata: { payment_id: paymentId, amount, reason }
  })
}

/**
 * Create notification for large payment
 */
export async function notifyLargePayment(paymentId: number, amount: number, userId: number) {
  return createNotification({
    type: 'success',
    title: 'Крупный платёж',
    message: `Получен платёж на сумму ${amount}₽`,
    metadata: { payment_id: paymentId, amount, user_id: userId }
  })
}

/**
 * Create notification for generation failure
 */
export async function notifyGenerationFailed(jobId: number, avatarId: number, error: string) {
  return createNotification({
    type: 'error',
    title: 'Ошибка генерации',
    message: `Генерация #${jobId} завершилась с ошибкой`,
    metadata: { job_id: jobId, avatar_id: avatarId, error }
  })
}

/**
 * Create notification for high failure rate
 */
export async function notifyHighFailureRate(rate: number, threshold: number) {
  return createNotification({
    type: 'warning',
    title: 'Высокий процент ошибок',
    message: `Процент ошибок генераций (${rate.toFixed(1)}%) превысил порог (${threshold}%)`,
    metadata: { failure_rate: rate, threshold }
  })
}

/**
 * Create notification for new withdrawal request
 */
export async function notifyNewWithdrawal(withdrawalId: number, amount: number, userId: number) {
  return createNotification({
    type: 'info',
    title: 'Новая заявка на вывод',
    message: `Пользователь запросил вывод ${amount}₽`,
    metadata: { withdrawal_id: withdrawalId, amount, user_id: userId }
  })
}

/**
 * Create notification for system event
 */
export async function notifySystemEvent(title: string, message?: string, metadata?: Record<string, unknown>) {
  return createNotification({
    type: 'info',
    title,
    message,
    metadata
  })
}
