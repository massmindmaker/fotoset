/**
 * GET /api/admin/referrals/withdrawals
 * List withdrawal requests
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = (page - 1) * limit

    const statusFilter = status || null

    // Get total count
    const [countResult] = await sql`
      SELECT COUNT(*) as count
      FROM referral_withdrawals rw
      WHERE (${statusFilter}::text IS NULL OR rw.status = ${statusFilter})
    `
    const total = parseInt(String(countResult?.count || 0), 10)

    // Get withdrawals
    const withdrawals = await sql`
      SELECT
        rw.id,
        rw.user_id,
        u.telegram_user_id,
        rw.amount,
        rw.ndfl_amount,
        rw.payout_amount,
        rw.method,
        rw.card_number,
        rw.phone,
        rw.status,
        COALESCE(rw.currency, 'RUB') as currency,
        rw.created_at,
        rw.processed_at,
        rb.balance as current_balance,
        rb.total_earned
      FROM referral_withdrawals rw
      JOIN users u ON u.id = rw.user_id
      LEFT JOIN referral_balances rb ON rb.user_id = rw.user_id
      WHERE (${statusFilter}::text IS NULL OR rw.status = ${statusFilter})
      ORDER BY
        CASE rw.status
          WHEN 'pending' THEN 1
          WHEN 'processing' THEN 2
          ELSE 3
        END,
        rw.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    return NextResponse.json({
      withdrawals: withdrawals.map((w: any) => ({
        id: w.id,
        user_id: w.user_id,
        telegram_user_id: String(w.telegram_user_id),
        amount: parseFloat(String(w.amount)),
        ndfl_amount: parseFloat(String(w.ndfl_amount || 0)),
        payout_amount: parseFloat(String(w.payout_amount)),
        method: w.method,
        card_number: w.card_number,
        phone: w.phone,
        status: w.status,
        currency: w.currency || 'RUB',
        created_at: w.created_at,
        processed_at: w.processed_at,
        current_balance: parseFloat(String(w.current_balance || 0)),
        total_earned: parseFloat(String(w.total_earned || 0))
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('[Admin Withdrawals] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch withdrawals' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { withdrawalId, status, errorMessage } = body

    if (!withdrawalId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const result = await sql`
      UPDATE referral_withdrawals
      SET
        status = ${status},
        error_message = ${errorMessage || null},
        processed_at = ${status === 'completed' || status === 'failed' ? sql`NOW()` : sql`processed_at`},
        updated_at = NOW()
      WHERE id = ${withdrawalId}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, withdrawal: result[0] })
  } catch (error) {
    console.error('[Admin Withdrawals PATCH] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update withdrawal' },
      { status: 500 }
    )
  }
}
