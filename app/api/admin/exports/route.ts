/**
 * GET /api/admin/exports
 * Export admin data in CSV, JSON, or Excel format
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60


import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
import { logAdminAction } from '@/lib/admin/audit'
import { toCSV, toJSON } from '@/lib/admin/export'

type ExportType = 'users' | 'payments' | 'generations' | 'referrals' | 'withdrawals'
type ExportFormat = 'csv' | 'json'
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as ExportType
    const format = (searchParams.get('format') || 'csv') as ExportFormat
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    if (!type || !['users', 'payments', 'generations', 'referrals', 'withdrawals'].includes(type)) {
      return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })
    }

    // Limit export size for performance
    const MAX_EXPORT_ROWS = 10000

    let data: Record<string, unknown>[] = []

    switch (type) {
      case 'users':
        data = await sql`
          SELECT
            u.id,
            u.telegram_user_id,
            u.telegram_username,
            u.is_banned,
            u.created_at,
            COUNT(DISTINCT a.id) as avatars_count,
            COUNT(DISTINCT p.id) as payments_count,
            COALESCE(SUM(CASE WHEN p.status = 'succeeded' THEN p.amount ELSE 0 END), 0) as total_spent,
            CASE WHEN COUNT(DISTINCT CASE WHEN p.status = 'succeeded' THEN p.id END) > 0 THEN true ELSE false END as has_paid
          FROM users u
          LEFT JOIN avatars a ON a.user_id = u.id
          LEFT JOIN payments p ON p.user_id = u.id
          WHERE
            (${dateFrom}::date IS NULL OR u.created_at >= ${dateFrom}::date)
            AND (${dateTo}::date IS NULL OR u.created_at <= ${dateTo}::date + INTERVAL '1 day')
          GROUP BY u.id, u.telegram_user_id, u.telegram_username, u.is_banned, u.created_at
          ORDER BY u.created_at DESC
          LIMIT ${MAX_EXPORT_ROWS}
        `
        break

      case 'payments':
        data = await sql`
          SELECT
            p.id,
            p.tbank_payment_id,
            p.user_id,
            u.telegram_user_id,
            p.amount,
            p.status,
            p.tier_id,
            p.photo_count,
            p.refund_amount,
            p.refund_at,
            p.created_at
          FROM payments p
          LEFT JOIN users u ON u.id = p.user_id
          WHERE
            (${dateFrom}::date IS NULL OR p.created_at >= ${dateFrom}::date)
            AND (${dateTo}::date IS NULL OR p.created_at <= ${dateTo}::date + INTERVAL '1 day')
          ORDER BY p.created_at DESC
          LIMIT ${MAX_EXPORT_ROWS}
        `
        break

      case 'generations':
        data = await sql`
          SELECT
            gj.id,
            gj.avatar_id,
            a.name as avatar_name,
            u.telegram_user_id,
            gj.status,
            gj.total_photos,
            gj.completed_photos,
            ROUND(COALESCE(gj.completed_photos::numeric / NULLIF(gj.total_photos, 0) * 100, 0), 1) as progress,
            EXTRACT(EPOCH FROM (gj.updated_at - gj.created_at))::int as duration,
            gj.error_message,
            gj.created_at
          FROM generation_jobs gj
          LEFT JOIN avatars a ON a.id = gj.avatar_id
          LEFT JOIN users u ON u.id = a.user_id
          WHERE
            (${dateFrom}::date IS NULL OR gj.created_at >= ${dateFrom}::date)
            AND (${dateTo}::date IS NULL OR gj.created_at <= ${dateTo}::date + INTERVAL '1 day')
          ORDER BY gj.created_at DESC
          LIMIT ${MAX_EXPORT_ROWS}
        `
        break

      case 'referrals':
        data = await sql`
          SELECT
            rb.user_id,
            u.telegram_user_id,
            rc.code as referral_code,
            COUNT(DISTINCT r.id) as referrals_count,
            COUNT(DISTINCT CASE WHEN r.has_paid THEN r.id END) as conversions,
            rb.balance,
            rb.total_earned,
            rb.total_withdrawn
          FROM referral_balances rb
          JOIN users u ON u.id = rb.user_id
          LEFT JOIN referral_codes rc ON rc.user_id = rb.user_id
          LEFT JOIN referrals r ON r.referrer_id = rb.user_id
          GROUP BY rb.user_id, u.telegram_user_id, rc.code, rb.balance, rb.total_earned, rb.total_withdrawn
          ORDER BY rb.total_earned DESC
          LIMIT ${MAX_EXPORT_ROWS}
        `
        break

      case 'withdrawals':
        data = await sql`
          SELECT
            rw.id,
            u.telegram_user_id,
            rw.amount,
            rw.ndfl_amount,
            rw.payout_amount,
            rw.method,
            rw.status,
            rw.created_at,
            rw.processed_at
          FROM referral_withdrawals rw
          JOIN users u ON u.id = rw.user_id
          WHERE
            (${dateFrom}::date IS NULL OR rw.created_at >= ${dateFrom}::date)
            AND (${dateTo}::date IS NULL OR rw.created_at <= ${dateTo}::date + INTERVAL '1 day')
          ORDER BY rw.created_at DESC
          LIMIT ${MAX_EXPORT_ROWS}
        `
        break
    }

    // Log export action
    await logAdminAction({
      adminId: session.adminId,
      action: 'data_exported',
      metadata: {
        type,
        format,
        rows: data.length,
        dateFrom,
        dateTo
      }
    })

    // Generate export content
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `${type}-export-${timestamp}`

    let content: string
    let mimeType: string
    let extension: string

    if (format === 'json') {
      content = toJSON(data)
      mimeType = 'application/json'
      extension = '.json'
    } else {
      content = toCSV(data)
      mimeType = 'text/csv; charset=utf-8'
      extension = '.csv'
    }

    // Return file download response
    return new NextResponse(content, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}${extension}"`,
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error) {
    console.error('[Admin Export] Error:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}
