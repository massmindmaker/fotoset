/**
 * GET /api/admin/telegram
 * Get Telegram message queue stats and messages
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'
import type { TelegramQueueStats, TelegramQueueMessage } from '@/lib/admin/types'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const rawStatus = searchParams.get('status')
    // Validate status against allowed values
    const allowedStatuses = ['pending', 'sent', 'failed', 'retry']
    const status = rawStatus && allowedStatuses.includes(rawStatus) ? rawStatus : null

    // Validate pagination bounds
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const offset = (page - 1) * limit

    const sql = getSql()

    // Check if table exists first
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'telegram_message_queue'
      ) as exists
    `

    if (!tableCheck[0]?.exists) {
      // Return empty data if table doesn't exist
      return NextResponse.json({
        stats: {
          pending: 0,
          sent: 0,
          failed: 0,
          retry: 0,
          total: 0,
          success_rate: 0
        },
        messages: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      })
    }

    // Get stats
    const statsQuery = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'retry') as retry,
        COUNT(*) as total
      FROM telegram_message_queue
    `

    const statsRow = statsQuery[0] || { pending: 0, sent: 0, failed: 0, retry: 0, total: 0 }
    const total = parseInt(String(statsRow.total || 0), 10)
    const sent = parseInt(String(statsRow.sent || 0), 10)

    const stats: TelegramQueueStats = {
      pending: parseInt(String(statsRow.pending || 0), 10),
      sent: sent,
      failed: parseInt(String(statsRow.failed || 0), 10),
      retry: parseInt(String(statsRow.retry || 0), 10),
      total: total,
      success_rate: total > 0 ? (sent / total) * 100 : 0
    }

    // Get messages with filtering
    const statusFilter = status

    const countQuery = await sql`
      SELECT COUNT(*) as count
      FROM telegram_message_queue
      WHERE (${statusFilter}::text IS NULL OR status = ${statusFilter})
    `

    const totalMessages = parseInt(String(countQuery[0]?.count || 0), 10)
    const totalPages = Math.ceil(totalMessages / limit)

    const messagesQuery = await sql`
      SELECT
        tmq.id,
        tmq.user_id,
        u.telegram_user_id,
        tmq.message_type,
        tmq.payload,
        tmq.status,
        tmq.retry_count,
        tmq.error_message,
        tmq.created_at,
        tmq.sent_at
      FROM telegram_message_queue tmq
      LEFT JOIN users u ON u.id = tmq.user_id
      WHERE (${statusFilter}::text IS NULL OR tmq.status = ${statusFilter})
      ORDER BY tmq.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `

    const messages: TelegramQueueMessage[] = messagesQuery.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      telegram_user_id: String(row.telegram_user_id || ''),
      message_type: row.message_type,
      payload: row.payload as Record<string, unknown>,
      status: row.status as TelegramQueueMessage['status'],
      retry_count: row.retry_count,
      error_message: row.error_message,
      created_at: row.created_at,
      sent_at: row.sent_at
    }))

    return NextResponse.json({
      stats,
      messages,
      pagination: {
        page,
        limit,
        total: totalMessages,
        totalPages
      }
    })
  } catch (error) {
    console.error('[Admin Telegram Queue] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch telegram queue' },
      { status: 500 }
    )
  }
}
