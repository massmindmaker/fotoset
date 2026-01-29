/**
 * GET /api/admin/search
 * Global search across users, payments, generations
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60


import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
interface SearchResult {
  type: 'user' | 'payment' | 'generation' | 'referral'
  id: number
  title: string
  subtitle: string
  url: string
  meta?: Record<string, unknown>
}

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50)

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] })
    }

    // Escape LIKE pattern special characters to prevent injection
    const escapeLikePattern = (str: string) =>
      str.replace(/[%_\\]/g, '\\$&')

    const safeQuery = escapeLikePattern(query)
    const results: SearchResult[] = []

    // Search by Telegram ID (numeric)
    const isNumeric = /^\d+$/.test(query)

    if (isNumeric) {
      // Search users by telegram_user_id
      const users = await sql`
        SELECT
          u.id,
          u.telegram_user_id,
          u.telegram_username,
          u.created_at,
          COUNT(DISTINCT p.id) as payments_count
        FROM users u
        LEFT JOIN payments p ON p.user_id = u.id AND p.status = 'succeeded'
        WHERE u.telegram_user_id::text LIKE ${safeQuery + '%'}
        GROUP BY u.id, u.telegram_user_id, u.telegram_username, u.created_at
        LIMIT ${limit}
      `

      for (const user of users) {
        const hasPaid = user.payments_count > 0
        const displayName = user.telegram_username ? `@${user.telegram_username}` : `User ${user.telegram_user_id}`
        results.push({
          type: 'user',
          id: user.id,
          title: displayName,
          subtitle: `${hasPaid ? 'Оплачено' : 'Бесплатно'} · ${user.payments_count} платежей`,
          url: `/admin/users?user=${user.id}`,
          meta: { telegram_user_id: user.telegram_user_id, telegram_username: user.telegram_username }
        })
      }

      // Search payments by ID
      const payments = await sql`
        SELECT
          p.id,
          p.tbank_payment_id,
          p.amount,
          p.status,
          u.telegram_user_id
        FROM payments p
        LEFT JOIN users u ON u.id = p.user_id
        WHERE
          p.id::text = ${query}
          OR p.tbank_payment_id LIKE ${safeQuery + '%'}
        LIMIT ${limit}
      `

      for (const payment of payments) {
        results.push({
          type: 'payment',
          id: payment.id,
          title: `Payment #${payment.id}`,
          subtitle: `${payment.amount}₽ · ${payment.status} · User ${payment.telegram_user_id || 'N/A'}`,
          url: `/admin/payments?payment=${payment.id}`,
          meta: { amount: payment.amount, status: payment.status }
        })
      }

      // Search generations by ID
      const generations = await sql`
        SELECT
          gj.id,
          gj.status,
          gj.completed_photos,
          gj.total_photos,
          a.name as avatar_name,
          u.telegram_user_id
        FROM generation_jobs gj
        LEFT JOIN avatars a ON a.id = gj.avatar_id
        LEFT JOIN users u ON u.id = a.user_id
        WHERE gj.id::text = ${query}
        LIMIT ${limit}
      `

      for (const gen of generations) {
        results.push({
          type: 'generation',
          id: gen.id,
          title: `Generation #${gen.id}`,
          subtitle: `${gen.status} · ${gen.completed_photos}/${gen.total_photos} фото · User ${gen.telegram_user_id || 'N/A'}`,
          url: `/admin/generations?job=${gen.id}`,
          meta: { status: gen.status, progress: gen.completed_photos / gen.total_photos }
        })
      }
    }

    // Search by T-Bank payment ID (alphanumeric)
    if (!isNumeric && query.length >= 3) {
      const payments = await sql`
        SELECT
          p.id,
          p.tbank_payment_id,
          p.amount,
          p.status,
          u.telegram_user_id
        FROM payments p
        LEFT JOIN users u ON u.id = p.user_id
        WHERE p.tbank_payment_id ILIKE ${`%${safeQuery}%`}
        LIMIT ${limit}
      `

      for (const payment of payments) {
        if (!results.find(r => r.type === 'payment' && r.id === payment.id)) {
          results.push({
            type: 'payment',
            id: payment.id,
            title: `Payment #${payment.id}`,
            subtitle: `${payment.amount}₽ · ${payment.status} · T-Bank: ${payment.tbank_payment_id}`,
            url: `/admin/payments?payment=${payment.id}`,
            meta: { amount: payment.amount, status: payment.status }
          })
        }
      }
    }

    // Search referral codes
    if (query.length >= 3) {
      const referrals = await sql`
        SELECT
          rc.id,
          rc.code,
          rc.user_id,
          u.telegram_user_id,
          COUNT(r.id) as referrals_count
        FROM referral_codes rc
        JOIN users u ON u.id = rc.user_id
        LEFT JOIN referrals r ON r.referrer_id = rc.user_id
        WHERE rc.code ILIKE ${`%${safeQuery}%`}
        GROUP BY rc.id, rc.code, rc.user_id, u.telegram_user_id
        LIMIT ${limit}
      `

      for (const ref of referrals) {
        results.push({
          type: 'referral',
          id: ref.id,
          title: `Referral Code: ${ref.code}`,
          subtitle: `User ${ref.telegram_user_id} · ${ref.referrals_count} рефералов`,
          url: `/admin/referrals?user=${ref.user_id}`,
          meta: { code: ref.code, referrals_count: ref.referrals_count }
        })
      }
    }

    // Sort by relevance (exact matches first)
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase().includes(query.toLowerCase()) ? 0 : 1
      const bExact = b.title.toLowerCase().includes(query.toLowerCase()) ? 0 : 1
      return aExact - bExact
    })

    return NextResponse.json({
      results: results.slice(0, limit),
      query,
      total: results.length
    })
  } catch (error) {
    console.error('[Admin Search] Error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
