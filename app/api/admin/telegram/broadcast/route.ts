/**
 * POST /api/admin/telegram/broadcast
 * Send broadcast message to multiple users
 *
 * Supports:
 * - Text messages with Telegram HTML formatting
 * - Photo messages with caption
 * - Target: all users, users with payments, or specific user IDs
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
import { logAdminAction } from '@/lib/admin/audit'
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SECURITY: Only super_admin can create broadcasts (mass messaging)
    if (session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: only super_admin can create broadcasts' }, { status: 403 })
    }

    const body = await request.json()
    const {
      message,
      photoUrl,
      target = 'all', // 'all' | 'paid' | 'active' | 'partners' | 'specific'
      userIds = [],   // for target='specific'
      parseMode = 'HTML',
      preview = false // if true, just return count without sending
    } = body as {
      message: string
      photoUrl?: string
      target: 'all' | 'paid' | 'active' | 'partners' | 'specific'
      userIds?: number[]
      parseMode?: 'HTML' | 'Markdown'
      preview?: boolean
    }

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }
    // Build query based on target
    let userQuery
    switch (target) {
      case 'paid':
        // Users who made at least one successful payment
        userQuery = sql`
          SELECT DISTINCT u.id, u.telegram_user_id, u.telegram_username
          FROM users u
          JOIN payments p ON p.user_id = u.id
          WHERE p.status = 'succeeded'
            AND u.telegram_user_id IS NOT NULL
            AND u.is_banned = false
        `
        break

      case 'active':
        // Users active in last 30 days (have avatars or payments recently)
        userQuery = sql`
          SELECT DISTINCT u.id, u.telegram_user_id, u.telegram_username
          FROM users u
          LEFT JOIN avatars a ON a.user_id = u.id
          LEFT JOIN payments p ON p.user_id = u.id
          WHERE u.telegram_user_id IS NOT NULL
            AND u.is_banned = false
            AND (
              a.created_at > NOW() - interval '30 days'
              OR p.created_at > NOW() - interval '30 days'
              OR u.created_at > NOW() - interval '30 days'
            )
        `
        break

      case 'partners':
        // Partners from referral program (is_partner = true)
        userQuery = sql`
          SELECT DISTINCT u.id, u.telegram_user_id, u.telegram_username
          FROM users u
          JOIN referral_balances rb ON rb.user_id = u.id
          WHERE rb.is_partner = true
            AND u.telegram_user_id IS NOT NULL
            AND u.is_banned = false
        `
        break

      case 'specific':
        if (!userIds || userIds.length === 0) {
          return NextResponse.json(
            { error: 'userIds required for specific target' },
            { status: 400 }
          )
        }
        userQuery = sql`
          SELECT id, telegram_user_id, telegram_username
          FROM users
          WHERE telegram_user_id = ANY(${userIds})
            AND is_banned = false
        `
        break

      case 'all':
      default:
        userQuery = sql`
          SELECT id, telegram_user_id, telegram_username
          FROM users
          WHERE telegram_user_id IS NOT NULL
            AND is_banned = false
        `
    }

    const users = await userQuery
    const targetCount = users.length

    // Preview mode - just return count
    if (preview) {
      return NextResponse.json({
        success: true,
        preview: true,
        targetCount,
        target,
        messagePreview: message.substring(0, 200)
      })
    }

    if (targetCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'No users match the target criteria'
      })
    }

    // Create broadcast record
    const [broadcast] = await sql`
      INSERT INTO telegram_broadcasts (
        admin_id,
        message,
        photo_url,
        parse_mode,
        target_type,
        target_count,
        status
      ) VALUES (
        ${session.adminId},
        ${message},
        ${photoUrl || null},
        ${parseMode},
        ${target},
        ${targetCount},
        'sending'
      )
      RETURNING id
    `

    // Queue messages for all target users
    const payload = photoUrl
      ? { text: message, photo: photoUrl, parse_mode: parseMode }
      : { text: message, parse_mode: parseMode }

    let queuedCount = 0
    for (const user of users) {
      await sql`
        INSERT INTO telegram_message_queue (
          user_id,
          message_type,
          payload,
          status,
          broadcast_id
        ) VALUES (
          ${user.id},
          'broadcast',
          ${JSON.stringify(payload)},
          'pending',
          ${broadcast.id}
        )
      `
      queuedCount++
    }

    // Update broadcast status
    await sql`
      UPDATE telegram_broadcasts
      SET queued_count = ${queuedCount}
      WHERE id = ${broadcast.id}
    `

    // Log action
    await logAdminAction({
      adminId: session.adminId,
      action: 'broadcast_created',
      targetId: broadcast.id,
      metadata: {
        target,
        target_count: targetCount,
        queued_count: queuedCount,
        has_photo: !!photoUrl,
        message_preview: message.substring(0, 100)
      }
    })

    return NextResponse.json({
      success: true,
      broadcastId: broadcast.id,
      targetCount,
      queuedCount
    })
  } catch (error) {
    console.error('[Admin Broadcast] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create broadcast' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/telegram/broadcast
 * Get broadcast history
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SECURITY: Only super_admin can view broadcast history
    if (session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: only super_admin can view broadcasts' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const broadcasts = await sql`
      SELECT
        b.id,
        b.message,
        b.photo_url,
        b.target_type,
        b.target_count,
        b.queued_count,
        b.sent_count,
        b.failed_count,
        b.status,
        b.created_at,
        b.completed_at
      FROM telegram_broadcasts b
      ORDER BY b.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    const [{ count }] = await sql`
      SELECT COUNT(*) as count FROM telegram_broadcasts
    `

    return NextResponse.json({
      broadcasts,
      total: parseInt(String(count), 10),
      limit,
      offset
    })
  } catch (error) {
    console.error('[Admin Broadcast List] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch broadcasts' },
      { status: 500 }
    )
  }
}
