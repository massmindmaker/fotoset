/**
 * Universal Referral Earnings Processing
 *
 * Handles commission payouts for all payment providers (tbank, stars, ton)
 * with partner commission support (10% regular, 50% partner).
 */

import { sql, query } from '@/lib/db'

const DEFAULT_REFERRAL_RATE = 0.10 // 10%
const PARTNER_REFERRAL_RATE = 0.50 // 50%

export interface ReferralEarningResult {
  success: boolean
  credited?: number
  referrerId?: number
  error?: string
  alreadyProcessed?: boolean
  provider?: string
}

/**
 * Process referral earning for a successful payment
 *
 * @param paymentId - Database payment.id (not provider-specific ID)
 * @param userId - User who made the payment
 * @returns Result with credited amount and referrer info
 *
 * @example
 * const result = await processReferralEarning(123, 456)
 * if (result.success && result.credited) {
 *   console.log(`Credited ${result.credited} to referrer ${result.referrerId}`)
 * }
 */
export async function processReferralEarning(
  paymentId: number,
  userId: number
): Promise<ReferralEarningResult> {
  try {
    // 1. Check if user has a referrer
    const referralCheck = await query(
      'SELECT referrer_id FROM referrals WHERE referred_user_id = $1',
      [userId]
    )

    if (referralCheck.rows.length === 0) {
      return {
        success: true,
        error: 'No referrer found for user'
      }
    }

    const referrerId = referralCheck.rows[0].referrer_id

    // 2. Get payment details (amount, provider, status)
    const paymentQuery = await query(
      `SELECT
        id,
        amount,
        provider,
        status,
        payment_id,
        telegram_charge_id,
        ton_tx_hash
      FROM payments
      WHERE id = $1`,
      [paymentId]
    )

    if (paymentQuery.rows.length === 0) {
      return {
        success: false,
        error: `Payment ${paymentId} not found`
      }
    }

    const payment = paymentQuery.rows[0]
    const provider = payment.provider || 'tbank'

    // Ensure payment is successful
    if (payment.status !== 'succeeded') {
      return {
        success: false,
        error: `Payment ${paymentId} status is ${payment.status}, not succeeded`
      }
    }

    // 3. Get referrer's commission rate
    const balanceQuery = await query(
      `SELECT is_partner, commission_rate
       FROM referral_balances
       WHERE user_id = $1`,
      [referrerId]
    )

    let commissionRate = DEFAULT_REFERRAL_RATE

    if (balanceQuery.rows.length > 0) {
      const balance = balanceQuery.rows[0]
      if (balance.is_partner) {
        commissionRate = balance.commission_rate || PARTNER_REFERRAL_RATE
      } else {
        commissionRate = balance.commission_rate || DEFAULT_REFERRAL_RATE
      }
    }

    // 4. Calculate earning amount
    const paymentAmount = parseFloat(payment.amount)
    const earningAmount = paymentAmount * commissionRate

    // 5. Insert earning record (idempotent with ON CONFLICT)
    const insertEarning = await query(
      `INSERT INTO referral_earnings (
        referrer_id,
        referred_user_id,
        payment_id,
        amount,
        provider
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (payment_id) DO NOTHING
      RETURNING id, amount`,
      [referrerId, userId, paymentId, earningAmount, provider]
    )

    // Check if already processed
    if (insertEarning.rows.length === 0) {
      console.log(`[Referral] Payment ${paymentId} (${provider}) already processed for referrer ${referrerId}`)
      return {
        success: true,
        alreadyProcessed: true,
        referrerId,
        provider
      }
    }

    // 6. Update referrer's balance atomically
    await query(
      `UPDATE referral_balances
       SET balance = balance + $1
       WHERE user_id = $2`,
      [earningAmount, referrerId]
    )

    console.log(
      `[Referral] ✅ Credited ${earningAmount.toFixed(2)} to referrer ${referrerId} ` +
      `(${commissionRate * 100}% of ${paymentAmount.toFixed(2)} from ${provider} payment ${paymentId})`
    )

    return {
      success: true,
      credited: earningAmount,
      referrerId,
      provider
    }

  } catch (error) {
    console.error('[Referral] Error processing earning:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get referral earnings summary for a referrer
 *
 * @param referrerId - The referrer's user ID
 * @returns Earnings breakdown by provider and total
 */
export async function getReferralEarningsSummary(referrerId: number) {
  const result = await query(
    `SELECT
      provider,
      COUNT(*) as earnings_count,
      SUM(amount) as total_amount
     FROM referral_earnings
     WHERE referrer_id = $1
     GROUP BY provider`,
    [referrerId]
  )

  const summary = result.rows.reduce((acc, row) => {
    acc[row.provider] = {
      count: parseInt(row.earnings_count),
      total: parseFloat(row.total_amount)
    }
    return acc
  }, {} as Record<string, { count: number; total: number }>)

  const totalAmount = result.rows.reduce((sum, row) => sum + parseFloat(row.total_amount), 0)
  const totalCount = result.rows.reduce((sum, row) => sum + parseInt(row.earnings_count), 0)

  return {
    byProvider: summary,
    total: {
      count: totalCount,
      amount: totalAmount
    }
  }
}

/**
 * Get all earnings for a referrer with pagination
 *
 * @param referrerId - The referrer's user ID
 * @param limit - Maximum number of records
 * @param offset - Offset for pagination
 */
export async function getReferralEarnings(
  referrerId: number,
  limit = 50,
  offset = 0
) {
  const result = await query(
    `SELECT
      re.id,
      re.amount,
      re.provider,
      re.created_at,
      re.referred_user_id,
      u.telegram_username as referred_username,
      p.payment_id,
      p.telegram_charge_id,
      p.ton_tx_hash,
      p.amount as payment_amount
     FROM referral_earnings re
     LEFT JOIN users u ON u.id = re.referred_user_id
     LEFT JOIN payments p ON p.id = re.payment_id
     WHERE re.referrer_id = $1
     ORDER BY re.created_at DESC
     LIMIT $2 OFFSET $3`,
    [referrerId, limit, offset]
  )

  return result.rows.map(row => ({
    id: row.id,
    amount: parseFloat(row.amount),
    provider: row.provider,
    createdAt: row.created_at,
    referredUserId: row.referred_user_id,
    referredUsername: row.referred_username,
    providerPaymentId: row.payment_id || row.telegram_charge_id || row.ton_tx_hash,
    paymentAmount: parseFloat(row.payment_amount)
  }))
}
