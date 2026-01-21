/**
 * POST /api/withdrawals/create
 *
 * Create a withdrawal request for referral earnings
 *
 * Requirements:
 * - Minimum withdrawal: 5,000₽
 * - User must have sufficient balance
 * - Phone number required for SBP payout
 * - INN optional (for self-employed - lower fees)
 *
 * Flow:
 * 1. User submits withdrawal request
 * 2. Request status = 'pending'
 * 3. Admin reviews and approves via /api/admin/withdrawals/process
 * 4. Jump.Finance processes SBP payout
 * 5. Webhook updates status to 'completed'
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { jumpFinance } from '@/lib/jump'
import { randomUUID } from 'crypto'

const MIN_WITHDRAWAL_AMOUNT = 5000 // 5,000₽

export async function POST(request: NextRequest) {
  try {
    // Get user from session/auth
    const telegramUserId = request.headers.get('x-telegram-user-id')

    if (!telegramUserId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login.' },
        { status: 401 }
      )
    }

    // Get user from DB with referral balance
    const user = await sql`
      SELECT
        u.id,
        u.telegram_user_id,
        u.telegram_username,
        rb.balance_rub,
        rb.is_partner,
        sev.is_verified as is_self_employed,
        sev.inn,
        pps.sbp_phone
      FROM users u
      LEFT JOIN referral_balances rb ON rb.user_id = u.id
      LEFT JOIN self_employed_verifications sev ON sev.user_id = u.id
        AND sev.is_verified = true
        AND (sev.expires_at IS NULL OR sev.expires_at > NOW())
      LEFT JOIN partner_payout_settings pps ON pps.user_id = u.id
      WHERE u.telegram_user_id = ${telegramUserId}
    `.then((rows: any[]) => rows[0])

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      amount,
      phone,
      inn, // Optional - for self-employed
    } = body

    // Validate amount
    const withdrawalAmount = Number(amount)
    if (!withdrawalAmount || isNaN(withdrawalAmount)) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    if (withdrawalAmount < MIN_WITHDRAWAL_AMOUNT) {
      return NextResponse.json(
        { error: `Минимальная сумма вывода: ${MIN_WITHDRAWAL_AMOUNT}₽` },
        { status: 400 }
      )
    }

    // Check balance
    const availableBalance = parseFloat(user.balance_rub || '0')

    // Get pending withdrawals
    const pendingWithdrawals = await sql`
      SELECT COALESCE(SUM(amount), 0) as pending_amount
      FROM withdrawals
      WHERE user_id = ${user.id} AND status IN ('pending', 'processing')
    `.then((rows: any[]) => parseFloat(rows[0]?.pending_amount || '0'))

    const actualAvailable = availableBalance - pendingWithdrawals

    if (withdrawalAmount > actualAvailable) {
      return NextResponse.json(
        {
          error: 'Недостаточно средств',
          details: {
            requested: withdrawalAmount,
            available: actualAvailable,
            balance: availableBalance,
            pending: pendingWithdrawals,
          }
        },
        { status: 400 }
      )
    }

    // Validate phone
    const payoutPhone = phone || user.sbp_phone
    if (!payoutPhone || !/^\+7\d{10}$/.test(payoutPhone)) {
      return NextResponse.json(
        { error: 'Укажите телефон для СБП в формате +7XXXXXXXXXX' },
        { status: 400 }
      )
    }

    // Determine if self-employed
    const isSelfEmployed = Boolean(user.is_self_employed) || Boolean(inn && /^\d{12}$/.test(inn))

    // Estimate fees
    const feeEstimate = jumpFinance.estimateFees(withdrawalAmount, isSelfEmployed)

    // Generate idempotency key
    const idempotencyKey = randomUUID()

    // Create withdrawal request
    const withdrawal = await sql`
      INSERT INTO withdrawals (
        user_id,
        amount,
        currency,
        payout_method,
        phone,
        inn,
        fee_amount,
        fee_percent,
        payout_amount,
        status,
        idempotency_key
      )
      VALUES (
        ${user.id},
        ${withdrawalAmount},
        'RUB',
        'sbp',
        ${payoutPhone},
        ${inn || user.inn || null},
        ${feeEstimate.feeAmount},
        ${feeEstimate.feePercent},
        ${feeEstimate.netAmount},
        'pending',
        ${idempotencyKey}
      )
      RETURNING id, amount, fee_amount, payout_amount, status, created_at
    `.then((rows: any[]) => rows[0])

    console.log('[withdrawals/create] Created withdrawal request', {
      withdrawalId: withdrawal.id,
      userId: user.id,
      amount: withdrawalAmount,
      feeAmount: feeEstimate.feeAmount,
      payoutAmount: feeEstimate.netAmount,
      isSelfEmployed,
    })

    return NextResponse.json({
      success: true,
      withdrawal: {
        id: withdrawal.id,
        amount: parseFloat(withdrawal.amount),
        feeAmount: parseFloat(withdrawal.fee_amount),
        payoutAmount: parseFloat(withdrawal.payout_amount),
        status: withdrawal.status,
        createdAt: withdrawal.created_at,
        phone: payoutPhone.slice(0, 4) + '****' + payoutPhone.slice(-2),
      },
      message: `Заявка на вывод ${withdrawalAmount}₽ создана. К выплате: ${feeEstimate.netAmount}₽ (комиссия ${feeEstimate.feePercent}%).`,
      estimatedProcessingTime: 'Обработка в течение 1-3 рабочих дней',
    })

  } catch (error) {
    console.error('[withdrawals/create] Error:', error)

    // Check for duplicate (idempotency)
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'Duplicate request. Please try again.' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET: List user's withdrawals
export async function GET(request: NextRequest) {
  try {
    const telegramUserId = request.headers.get('x-telegram-user-id')

    if (!telegramUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await sql`
      SELECT id FROM users WHERE telegram_user_id = ${telegramUserId}
    `.then((rows: any[]) => rows[0])

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get withdrawals with pagination
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const withdrawals = await sql`
      SELECT
        id,
        amount,
        currency,
        payout_method,
        phone,
        fee_amount,
        fee_percent,
        payout_amount,
        status,
        error_message,
        jump_receipt_url,
        created_at,
        processed_at,
        completed_at
      FROM withdrawals
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    const total = await sql`
      SELECT COUNT(*) as count FROM withdrawals WHERE user_id = ${user.id}
    `.then((rows: any[]) => parseInt(rows[0]?.count || '0'))

    return NextResponse.json({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withdrawals: withdrawals.map((w: any) => ({
        id: w.id,
        amount: parseFloat(w.amount),
        currency: w.currency,
        payoutMethod: w.payout_method,
        phone: w.phone ? w.phone.slice(0, 4) + '****' + w.phone.slice(-2) : null,
        feeAmount: parseFloat(w.fee_amount || '0'),
        feePercent: parseFloat(w.fee_percent || '0'),
        payoutAmount: parseFloat(w.payout_amount || '0'),
        status: w.status,
        errorMessage: w.error_message,
        receiptUrl: w.jump_receipt_url,
        createdAt: w.created_at,
        processedAt: w.processed_at,
        completedAt: w.completed_at,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + withdrawals.length < total,
      }
    })

  } catch (error) {
    console.error('[withdrawals/create] GET Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
