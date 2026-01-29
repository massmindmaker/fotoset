/**
 * POST /api/admin/withdrawals/process
 *
 * Admin endpoint to approve and process withdrawal via Jump.Finance SBP
 *
 * Flow:
 * 1. Admin reviews pending withdrawal
 * 2. Admin clicks "Process" button
 * 3. This endpoint:
 *    - Validates withdrawal is pending
 *    - Checks user balance
 *    - Deducts from referral_balances atomically
 *    - Calls Jump.Finance createPayout()
 *    - Updates withdrawal status to 'processing'
 * 4. Jump.Finance webhook updates status to 'completed' or 'failed'
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60


import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getCurrentSession } from '@/lib/admin/session'
import { hasPermission } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'
import { jumpFinance } from '@/lib/jump'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Permission check
    if (!hasPermission(session.role as 'super_admin' | 'admin' | 'viewer', 'referrals.approve_withdrawal')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { withdrawalId, action } = body as {
      withdrawalId: number
      action: 'process' | 'reject'
    }

    if (!withdrawalId) {
      return NextResponse.json({ error: 'Missing withdrawalId' }, { status: 400 })
    }

    if (!['process', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use "process" or "reject"' }, { status: 400 })
    }

    // Get withdrawal with user info
    const withdrawal = await sql`
      SELECT
        w.*,
        u.telegram_user_id,
        u.telegram_username,
        rb.balance_rub,
        sev.full_name
      FROM withdrawals w
      JOIN users u ON u.id = w.user_id
      LEFT JOIN referral_balances rb ON rb.user_id = w.user_id
      LEFT JOIN self_employed_verifications sev ON sev.user_id = w.user_id AND sev.is_verified = true
      WHERE w.id = ${withdrawalId}
    `.then((rows: any[]) => rows[0])

    if (!withdrawal) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
    }

    if (withdrawal.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot ${action} withdrawal with status: ${withdrawal.status}` },
        { status: 400 }
      )
    }

    // Handle rejection
    if (action === 'reject') {
      const { reason } = body as { reason?: string }

      await sql`
        UPDATE withdrawals
        SET
          status = 'rejected',
          error_message = ${reason || 'Rejected by admin'},
          processed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${withdrawalId}
      `

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

      return NextResponse.json({
        success: true,
        action: 'rejected',
        withdrawalId
      })
    }

    // Process withdrawal via Jump.Finance

    // 1. Check balance
    const currentBalance = parseFloat(withdrawal.balance_rub || '0')
    const withdrawalAmount = parseFloat(withdrawal.amount)

    if (currentBalance < withdrawalAmount) {
      return NextResponse.json(
        {
          error: 'Insufficient balance',
          details: {
            requested: withdrawalAmount,
            available: currentBalance
          }
        },
        { status: 400 }
      )
    }

    // 2. Check if Jump.Finance is configured
    if (!jumpFinance.isConfigured()) {
      // Manual processing fallback
      console.log('[Admin Withdrawals] Jump.Finance not configured, using manual processing')

      // Atomic balance deduction
      const updateResult = await sql`
        WITH balance_check AS (
          SELECT balance_rub
          FROM referral_balances
          WHERE user_id = ${withdrawal.user_id}
          FOR UPDATE
        ),
        withdrawal_update AS (
          UPDATE withdrawals
          SET
            status = 'processing',
            processed_at = NOW(),
            updated_at = NOW()
          WHERE id = ${withdrawalId}
            AND status = 'pending'
          RETURNING id
        ),
        balance_update AS (
          UPDATE referral_balances
          SET
            balance_rub = balance_rub - ${withdrawalAmount},
            total_withdrawn_rub = COALESCE(total_withdrawn_rub, 0) + ${withdrawal.payout_amount},
            updated_at = NOW()
          WHERE user_id = ${withdrawal.user_id}
            AND balance_rub >= ${withdrawalAmount}
            AND EXISTS (SELECT 1 FROM withdrawal_update)
          RETURNING user_id
        )
        SELECT
          (SELECT id FROM withdrawal_update) as withdrawal_updated,
          (SELECT user_id FROM balance_update) as balance_updated
      `

      if (!updateResult[0]?.withdrawal_updated || !updateResult[0]?.balance_updated) {
        return NextResponse.json(
          { error: 'Failed to process withdrawal - possibly already processed or insufficient balance' },
          { status: 409 }
        )
      }

      await logAdminAction({
        adminId: session.adminId,
        action: 'withdrawal_processing_manual',
        targetType: 'withdrawal',
        targetId: withdrawalId,
        metadata: {
          user_id: withdrawal.user_id,
          amount: withdrawalAmount,
          payout_amount: withdrawal.payout_amount,
          note: 'Jump.Finance not configured - manual processing required'
        }
      })

      return NextResponse.json({
        success: true,
        action: 'processing',
        withdrawalId,
        manualProcessing: true,
        message: 'Withdrawal marked as processing. Jump.Finance not configured - complete manually via SBP.',
        payoutDetails: {
          phone: withdrawal.phone,
          amount: parseFloat(withdrawal.payout_amount),
          recipientName: withdrawal.full_name
        }
      })
    }

    // 3. Process via Jump.Finance
    // First, atomic balance deduction
    const updateResult = await sql`
      WITH balance_check AS (
        SELECT balance_rub
        FROM referral_balances
        WHERE user_id = ${withdrawal.user_id}
        FOR UPDATE
      ),
      withdrawal_update AS (
        UPDATE withdrawals
        SET
          status = 'processing',
          processed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${withdrawalId}
          AND status = 'pending'
        RETURNING id
      ),
      balance_update AS (
        UPDATE referral_balances
        SET
          balance_rub = balance_rub - ${withdrawalAmount},
          total_withdrawn_rub = COALESCE(total_withdrawn_rub, 0) + ${withdrawal.payout_amount},
          updated_at = NOW()
        WHERE user_id = ${withdrawal.user_id}
          AND balance_rub >= ${withdrawalAmount}
          AND EXISTS (SELECT 1 FROM withdrawal_update)
        RETURNING user_id
      )
      SELECT
        (SELECT id FROM withdrawal_update) as withdrawal_updated,
        (SELECT user_id FROM balance_update) as balance_updated
    `

    if (!updateResult[0]?.withdrawal_updated || !updateResult[0]?.balance_updated) {
      return NextResponse.json(
        { error: 'Failed to process withdrawal - possibly already processed or insufficient balance' },
        { status: 409 }
      )
    }

    // 4. Call Jump.Finance
    const payoutResult = await jumpFinance.createPayout({
      orderId: `WD-${withdrawalId}`,
      recipientPhone: withdrawal.phone,
      amount: parseFloat(withdrawal.payout_amount),
      description: `PinGlass referral payout #${withdrawalId}`,
      inn: withdrawal.inn || undefined,
      recipientName: withdrawal.full_name || undefined
    })

    if (!payoutResult.success) {
      // Rollback - restore balance
      await sql`
        UPDATE referral_balances
        SET
          balance_rub = balance_rub + ${withdrawalAmount},
          total_withdrawn_rub = total_withdrawn_rub - ${withdrawal.payout_amount},
          updated_at = NOW()
        WHERE user_id = ${withdrawal.user_id}
      `

      await sql`
        UPDATE withdrawals
        SET
          status = 'failed',
          error_message = ${payoutResult.error || 'Jump.Finance payout failed'},
          updated_at = NOW()
        WHERE id = ${withdrawalId}
      `

      await logAdminAction({
        adminId: session.adminId,
        action: 'withdrawal_failed',
        targetType: 'withdrawal',
        targetId: withdrawalId,
        metadata: {
          user_id: withdrawal.user_id,
          amount: withdrawalAmount,
          error: payoutResult.error,
          errorCode: payoutResult.errorCode
        }
      })

      return NextResponse.json(
        {
          success: false,
          error: payoutResult.error || 'Jump.Finance payout failed',
          errorCode: payoutResult.errorCode
        },
        { status: 500 }
      )
    }

    // 5. Update withdrawal with Jump.Finance details
    await sql`
      UPDATE withdrawals
      SET
        jump_payout_id = ${payoutResult.jumpPayoutId},
        jump_receipt_url = ${payoutResult.receiptUrl || null},
        updated_at = NOW()
      WHERE id = ${withdrawalId}
    `

    await logAdminAction({
      adminId: session.adminId,
      action: 'withdrawal_sent_to_jump',
      targetType: 'withdrawal',
      targetId: withdrawalId,
      metadata: {
        user_id: withdrawal.user_id,
        amount: withdrawalAmount,
        payout_amount: withdrawal.payout_amount,
        jump_payout_id: payoutResult.jumpPayoutId
      }
    })

    console.log('[Admin Withdrawals] Sent to Jump.Finance', {
      withdrawalId,
      jumpPayoutId: payoutResult.jumpPayoutId,
      amount: withdrawal.payout_amount
    })

    return NextResponse.json({
      success: true,
      action: 'processing',
      withdrawalId,
      jumpPayoutId: payoutResult.jumpPayoutId,
      status: payoutResult.status,
      receiptUrl: payoutResult.receiptUrl,
      message: 'Payout sent to Jump.Finance. Status will be updated via webhook.'
    })

  } catch (error) {
    console.error('[Admin Withdrawals Process] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET: List withdrawals from new table (for admin panel)
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
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM withdrawals w
      WHERE (${statusFilter}::text IS NULL OR w.status = ${statusFilter})
    `.then((rows: any[]) => rows[0])
    const total = parseInt(countResult?.count || '0')

    // Get withdrawals
    const withdrawals = await sql`
      SELECT
        w.id,
        w.user_id,
        u.telegram_user_id,
        u.telegram_username,
        w.amount,
        w.currency,
        w.payout_method,
        w.phone,
        w.inn,
        w.fee_amount,
        w.fee_percent,
        w.payout_amount,
        w.status,
        w.error_message,
        w.jump_payout_id,
        w.jump_receipt_url,
        w.created_at,
        w.processed_at,
        w.completed_at,
        rb.balance_rub as current_balance,
        sev.is_verified as is_self_employed,
        sev.full_name
      FROM withdrawals w
      JOIN users u ON u.id = w.user_id
      LEFT JOIN referral_balances rb ON rb.user_id = w.user_id
      LEFT JOIN self_employed_verifications sev ON sev.user_id = w.user_id AND sev.is_verified = true
      WHERE (${statusFilter}::text IS NULL OR w.status = ${statusFilter})
      ORDER BY
        CASE w.status
          WHEN 'pending' THEN 1
          WHEN 'processing' THEN 2
          ELSE 3
        END,
        w.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    return NextResponse.json({
      withdrawals: withdrawals.map((w: any) => ({
        id: w.id,
        userId: w.user_id,
        telegramUserId: String(w.telegram_user_id),
        telegramUsername: w.telegram_username,
        amount: parseFloat(w.amount),
        currency: w.currency,
        payoutMethod: w.payout_method,
        phone: w.phone,
        inn: w.inn ? w.inn.slice(0, 4) + '****' + w.inn.slice(-2) : null,
        feeAmount: parseFloat(w.fee_amount || '0'),
        feePercent: parseFloat(w.fee_percent || '0'),
        payoutAmount: parseFloat(w.payout_amount || '0'),
        status: w.status,
        errorMessage: w.error_message,
        jumpPayoutId: w.jump_payout_id,
        receiptUrl: w.jump_receipt_url,
        createdAt: w.created_at,
        processedAt: w.processed_at,
        completedAt: w.completed_at,
        currentBalance: parseFloat(w.current_balance || '0'),
        isSelfEmployed: w.is_self_employed || false,
        recipientName: w.full_name
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('[Admin Withdrawals GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch withdrawals' },
      { status: 500 }
    )
  }
}
