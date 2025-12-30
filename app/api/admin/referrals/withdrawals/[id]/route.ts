/**
 * POST /api/admin/referrals/withdrawals/[id]
 * Approve or reject a withdrawal request
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'
import { logAdminAction } from '@/lib/admin/audit'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const withdrawalId = parseInt(id, 10)

    if (isNaN(withdrawalId)) {
      return NextResponse.json({ error: 'Invalid withdrawal ID' }, { status: 400 })
    }

    const body = await request.json()
    const { action, reason } = body as { action: 'approve' | 'reject'; reason?: string }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const sql = getSql()

    // Get withdrawal
    const [withdrawal] = await sql`
      SELECT
        rw.*,
        rb.balance
      FROM referral_withdrawals rw
      JOIN referral_balances rb ON rb.user_id = rw.user_id
      WHERE rw.id = ${withdrawalId}
    `

    if (!withdrawal) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
    }

    if (withdrawal.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot ${action} withdrawal with status: ${withdrawal.status}` },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      // Check if user has enough balance
      if (parseFloat(String(withdrawal.balance)) < parseFloat(String(withdrawal.amount))) {
        return NextResponse.json(
          { error: 'Insufficient balance' },
          { status: 400 }
        )
      }

      // Use atomic update with row-level locking to prevent race conditions
      // This ensures balance check and deduction happen atomically
      const updateResult = await sql`
        WITH balance_check AS (
          SELECT balance
          FROM referral_balances
          WHERE user_id = ${withdrawal.user_id}
          FOR UPDATE
        ),
        withdrawal_update AS (
          UPDATE referral_withdrawals
          SET
            status = 'approved',
            processed_at = NOW()
          WHERE id = ${withdrawalId}
            AND status = 'pending'
          RETURNING id
        ),
        balance_update AS (
          UPDATE referral_balances
          SET
            balance = balance - ${withdrawal.amount},
            total_withdrawn = total_withdrawn + ${withdrawal.payout_amount},
            updated_at = NOW()
          WHERE user_id = ${withdrawal.user_id}
            AND balance >= ${withdrawal.amount}
            AND EXISTS (SELECT 1 FROM withdrawal_update)
          RETURNING user_id
        )
        SELECT
          (SELECT id FROM withdrawal_update) as withdrawal_updated,
          (SELECT user_id FROM balance_update) as balance_updated
      `

      // Check if both updates succeeded
      if (!updateResult[0]?.withdrawal_updated || !updateResult[0]?.balance_updated) {
        return NextResponse.json(
          { error: 'Withdrawal failed - possibly already processed or insufficient balance' },
          { status: 409 }
        )
      }

      // Log action
      await logAdminAction({
        adminId: session.adminId,
        action: 'withdrawal_approved',
        targetType: 'withdrawal',
        targetId: withdrawalId,
        metadata: {
          user_id: withdrawal.user_id,
          amount: withdrawal.amount,
          payout_amount: withdrawal.payout_amount
        }
      })
    } else {
      // Reject withdrawal
      await sql`
        UPDATE referral_withdrawals
        SET
          status = 'rejected',
          processed_at = NOW()
        WHERE id = ${withdrawalId}
      `

      // Log action
      await logAdminAction({
        adminId: session.adminId,
        action: 'withdrawal_rejected',
        targetType: 'withdrawal',
        targetId: withdrawalId,
        metadata: {
          user_id: withdrawal.user_id,
          amount: withdrawal.amount,
          reason: reason || 'No reason provided'
        }
      })
    }

    return NextResponse.json({
      success: true,
      action,
      withdrawalId
    })
  } catch (error) {
    console.error('[Admin Withdrawal Action] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process withdrawal' },
      { status: 500 }
    )
  }
}
