/**
 * Universal Referral Earnings Processing (v2 - Deferred)
 *
 * Multi-currency support:
 * - T-Bank (RUB): Our system, stored in balance_rub
 * - Stars: Handled by Telegram Affiliate Program (SKIPPED here)
 * - TON: Our system, stored in balance_ton
 *
 * Commission rates:
 * - Regular users: 10%
 * - Partners: 50% (or custom rate)
 *
 * NEW in v2 - Deferred Earnings Flow:
 * 1. Payment succeeded → createPendingEarning() → status='pending', balance NOT updated
 * 2. Generation completed → creditPendingEarning() → status='credited', balance updated
 * 3. Refund before generation → cancelPendingEarning() → status='cancelled'
 *
 * This protects against chargebacks - referrals only credited after user receives value
 */

import { query } from '@/lib/db'

const DEFAULT_REFERRAL_RATE = 0.10 // 10%
const PARTNER_REFERRAL_RATE = 0.50 // 50%

export interface ReferralEarningResult {
  success: boolean
  earningId?: number
  credited?: number
  creditedCurrency?: 'RUB' | 'TON' | 'STARS'
  nativeAmount?: number
  referrerId?: number
  error?: string
  alreadyProcessed?: boolean
  skippedReason?: string
  provider?: string
}

export interface CancelEarningResult {
  success: boolean
  wasPending: boolean
  wasAlreadyCredited?: boolean
  error?: string
  earningId?: number
}

export interface CreditEarningResult {
  success: boolean
  credited?: number
  creditedCurrency?: 'RUB' | 'TON'
  referrerId?: number
  error?: string
  alreadyCredited?: boolean
}

/**
 * Create a PENDING referral earning when payment succeeds
 *
 * This does NOT update the referrer's balance - that happens later
 * when the generation completes via creditPendingEarning()
 *
 * @param paymentId - Database payment.id (not provider-specific ID)
 * @param userId - User who made the payment
 * @param generationJobId - Optional generation job ID to link earning
 * @returns Result with earning info (pending, not yet credited)
 *
 * @example
 * const result = await createPendingEarning(123, 456, 789)
 * if (result.success && result.earningId) {
 *   console.log(`Created pending earning ${result.earningId} for referrer ${result.referrerId}`)
 * }
 */
export async function createPendingEarning(
  paymentId: number,
  userId: number,
  generationJobId?: number
): Promise<ReferralEarningResult> {
  try {
    // 1. Check if user has a referrer
    const referralCheck = await query(
      'SELECT referrer_id FROM referrals WHERE referred_id = $1',
      [userId]
    )

    if (referralCheck.rows.length === 0) {
      return {
        success: true,
        error: 'No referrer found for user'
      }
    }

    const referrerId = referralCheck.rows[0].referrer_id

    // 2. Get payment details (amount, provider, status, native amounts)
    const paymentQuery = await query(
      `SELECT
        id,
        amount,
        provider,
        status,
        payment_id,
        telegram_charge_id,
        ton_tx_hash,
        stars_amount,
        ton_amount
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

    // ============================================================
    // STARS: Skip processing - Telegram Affiliate Program handles it
    // ============================================================
    if (provider === 'stars') {
      console.log(
        `[Referral] ⏭️ Skipping Stars payment ${paymentId} - handled by Telegram Affiliate Program`
      )
      return {
        success: true,
        skippedReason: 'Stars referrals handled by Telegram Affiliate Program',
        provider: 'stars'
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

    // 4. Calculate earning amount based on provider
    let earningAmount: number
    let nativeAmount: number
    let currency: 'RUB' | 'TON'

    if (provider === 'ton') {
      // TON: Calculate commission in TON
      nativeAmount = parseFloat(payment.ton_amount || '0')
      earningAmount = nativeAmount * commissionRate
      currency = 'TON'
    } else {
      // T-Bank (RUB): Use RUB amount
      nativeAmount = parseFloat(payment.amount)
      earningAmount = nativeAmount * commissionRate
      currency = 'RUB'
    }

    // 5. Insert earning record with status='pending' (idempotent with ON CONFLICT)
    // NOTE: Balance is NOT updated here - that happens in creditPendingEarning()
    const insertEarning = await query(
      `INSERT INTO referral_earnings (
        referrer_id,
        referred_user_id,
        payment_id,
        amount,
        provider,
        currency,
        native_amount,
        status,
        generation_job_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
      ON CONFLICT (payment_id) DO NOTHING
      RETURNING id, amount, status`,
      [referrerId, userId, paymentId, earningAmount, provider, currency, nativeAmount, generationJobId || null]
    )

    // Check if already processed
    if (insertEarning.rows.length === 0) {
      console.log(`[Referral] Payment ${paymentId} (${provider}) already has earning record for referrer ${referrerId}`)
      return {
        success: true,
        alreadyProcessed: true,
        referrerId,
        provider
      }
    }

    const currencySymbol = currency === 'TON' ? 'TON' : '₽'
    console.log(
      `[Referral] ⏳ Created PENDING earning ${insertEarning.rows[0].id}: ` +
      `${earningAmount.toFixed(currency === 'TON' ? 6 : 2)} ${currencySymbol} for referrer ${referrerId} ` +
      `(${commissionRate * 100}% of ${nativeAmount.toFixed(currency === 'TON' ? 6 : 2)} ${currencySymbol} from ${provider} payment ${paymentId})`
    )

    return {
      success: true,
      earningId: insertEarning.rows[0].id,
      credited: earningAmount, // Amount to be credited (not yet credited)
      creditedCurrency: currency,
      nativeAmount,
      referrerId,
      provider
    }

  } catch (error) {
    console.error('[Referral] Error creating pending earning:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Credit a pending earning to the referrer's balance
 *
 * Called after generation successfully completes
 *
 * @param paymentId - The payment ID to find the pending earning
 * @param generationJobId - The generation job that triggered the credit
 * @returns Result with credited amount
 */
export async function creditPendingEarning(
  paymentId: number,
  generationJobId: number
): Promise<CreditEarningResult> {
  try {
    // 1. Find the pending earning for this payment
    const earningQuery = await query(
      `SELECT id, referrer_id, amount, currency, status
       FROM referral_earnings
       WHERE payment_id = $1`,
      [paymentId]
    )

    if (earningQuery.rows.length === 0) {
      console.log(`[Referral] No earning found for payment ${paymentId}`)
      return {
        success: true,
        error: 'No earning found for this payment'
      }
    }

    const earning = earningQuery.rows[0]

    // 2. Check if already credited
    if (earning.status === 'credited' || earning.status === 'confirmed') {
      console.log(`[Referral] Earning ${earning.id} already credited`)
      return {
        success: true,
        alreadyCredited: true,
        referrerId: earning.referrer_id
      }
    }

    // 3. Check if cancelled
    if (earning.status === 'cancelled') {
      console.log(`[Referral] Earning ${earning.id} was cancelled, cannot credit`)
      return {
        success: false,
        error: 'Earning was cancelled due to refund'
      }
    }

    const earningAmount = parseFloat(earning.amount)
    const currency = earning.currency as 'RUB' | 'TON'
    const referrerId = earning.referrer_id

    // 4. ATOMICALLY update earning status AND balance using CTE
    // This ensures both operations succeed or both fail
    if (currency === 'TON') {
      const result = await query(
        `WITH earning_update AS (
          UPDATE referral_earnings
          SET status = 'credited',
              generation_job_id = $2,
              credited_at = NOW()
          WHERE id = $1 AND status = 'pending'
          RETURNING id, referrer_id, amount
        ),
        balance_update AS (
          UPDATE referral_balances
          SET balance_ton = balance_ton + $3,
              earned_ton = earned_ton + $3
          WHERE user_id = $4
            AND EXISTS (SELECT 1 FROM earning_update)
          RETURNING user_id
        )
        SELECT
          (SELECT id FROM earning_update) as earning_updated,
          (SELECT user_id FROM balance_update) as balance_updated`,
        [earning.id, generationJobId, earningAmount, referrerId]
      )

      if (!result.rows[0]?.earning_updated) {
        console.warn(`[Referral] Earning ${earning.id} was not updated (possibly already credited)`)
        return {
          success: true,
          alreadyCredited: true,
          referrerId
        }
      }
    } else {
      // RUB - same atomic pattern
      const result = await query(
        `WITH earning_update AS (
          UPDATE referral_earnings
          SET status = 'credited',
              generation_job_id = $2,
              credited_at = NOW()
          WHERE id = $1 AND status = 'pending'
          RETURNING id, referrer_id, amount
        ),
        balance_update AS (
          UPDATE referral_balances
          SET balance = balance + $3,
              balance_rub = balance_rub + $3,
              earned_rub = earned_rub + $3
          WHERE user_id = $4
            AND EXISTS (SELECT 1 FROM earning_update)
          RETURNING user_id
        )
        SELECT
          (SELECT id FROM earning_update) as earning_updated,
          (SELECT user_id FROM balance_update) as balance_updated`,
        [earning.id, generationJobId, earningAmount, referrerId]
      )

      if (!result.rows[0]?.earning_updated) {
        console.warn(`[Referral] Earning ${earning.id} was not updated (possibly already credited)`)
        return {
          success: true,
          alreadyCredited: true,
          referrerId
        }
      }
    }

    const currencySymbol = currency === 'TON' ? 'TON' : '₽'
    console.log(
      `[Referral] ✅ CREDITED earning ${earning.id}: ${earningAmount.toFixed(currency === 'TON' ? 6 : 2)} ${currencySymbol} ` +
      `to referrer ${referrerId} (generation job ${generationJobId})`
    )

    return {
      success: true,
      credited: earningAmount,
      creditedCurrency: currency,
      referrerId
    }

  } catch (error) {
    console.error('[Referral] Error crediting pending earning:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Cancel a pending earning (e.g., due to refund before generation)
 *
 * Can only cancel earnings with status='pending'
 * Already credited earnings require manual reversal
 *
 * @param paymentId - The payment ID to find the earning
 * @param reason - Reason for cancellation
 * @returns Result indicating if cancellation was successful
 */
export async function cancelPendingEarning(
  paymentId: number,
  reason: string = 'refund_before_generation'
): Promise<CancelEarningResult> {
  try {
    // 1. Find the earning for this payment
    const earningQuery = await query(
      `SELECT id, referrer_id, amount, currency, status
       FROM referral_earnings
       WHERE payment_id = $1`,
      [paymentId]
    )

    if (earningQuery.rows.length === 0) {
      console.log(`[Referral] No earning found for payment ${paymentId} - nothing to cancel`)
      return {
        success: true,
        wasPending: false
      }
    }

    const earning = earningQuery.rows[0]

    // 2. Check if already cancelled
    if (earning.status === 'cancelled') {
      console.log(`[Referral] Earning ${earning.id} already cancelled`)
      return {
        success: true,
        wasPending: false,
        earningId: earning.id
      }
    }

    // 3. Check if already credited - cannot cancel!
    if (earning.status === 'credited' || earning.status === 'confirmed') {
      console.warn(`[Referral] ⚠️ Earning ${earning.id} already CREDITED - cannot cancel automatically`)
      return {
        success: false,
        wasPending: false,
        wasAlreadyCredited: true,
        earningId: earning.id,
        error: `Earning ${earning.id} already credited to balance. Manual reversal required.`
      }
    }

    // 4. Status is 'pending' - safe to cancel
    await query(
      `UPDATE referral_earnings
       SET status = 'cancelled',
           cancelled_at = NOW(),
           cancelled_reason = $2
       WHERE id = $1`,
      [earning.id, reason]
    )

    console.log(
      `[Referral] 🚫 CANCELLED pending earning ${earning.id} for payment ${paymentId}. ` +
      `Reason: ${reason}. Amount not credited: ${earning.amount} ${earning.currency}`
    )

    return {
      success: true,
      wasPending: true,
      earningId: earning.id
    }

  } catch (error) {
    console.error('[Referral] Error cancelling pending earning:', error)
    return {
      success: false,
      wasPending: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * [DEPRECATED] Process referral earning for a successful payment
 *
 * @deprecated Use createPendingEarning() instead for new integrations.
 * This function immediately credits the balance (old behavior).
 * Kept for backward compatibility during transition.
 */
export async function processReferralEarning(
  paymentId: number,
  userId: number
): Promise<ReferralEarningResult> {
  console.warn('[Referral] ⚠️ processReferralEarning is DEPRECATED. Use createPendingEarning() + creditPendingEarning() instead.')

  try {
    // 1. Check if user has a referrer
    const referralCheck = await query(
      'SELECT referrer_id FROM referrals WHERE referred_id = $1',
      [userId]
    )

    if (referralCheck.rows.length === 0) {
      return {
        success: true,
        error: 'No referrer found for user'
      }
    }

    const referrerId = referralCheck.rows[0].referrer_id

    // 2. Get payment details (amount, provider, status, native amounts)
    const paymentQuery = await query(
      `SELECT
        id,
        amount,
        provider,
        status,
        payment_id,
        telegram_charge_id,
        ton_tx_hash,
        stars_amount,
        ton_amount
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

    // ============================================================
    // STARS: Skip processing - Telegram Affiliate Program handles it
    // ============================================================
    if (provider === 'stars') {
      console.log(
        `[Referral] ⏭️ Skipping Stars payment ${paymentId} - handled by Telegram Affiliate Program`
      )
      return {
        success: true,
        skippedReason: 'Stars referrals handled by Telegram Affiliate Program',
        provider: 'stars'
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

    // 4. Calculate earning amount based on provider
    let earningAmount: number
    let nativeAmount: number
    let currency: 'RUB' | 'TON'

    if (provider === 'ton') {
      // TON: Calculate commission in TON
      nativeAmount = parseFloat(payment.ton_amount || '0')
      earningAmount = nativeAmount * commissionRate
      currency = 'TON'
    } else {
      // T-Bank (RUB): Use RUB amount
      nativeAmount = parseFloat(payment.amount)
      earningAmount = nativeAmount * commissionRate
      currency = 'RUB'
    }

    // 5. Insert earning record with status='credited' (idempotent with ON CONFLICT)
    const insertEarning = await query(
      `INSERT INTO referral_earnings (
        referrer_id,
        referred_user_id,
        payment_id,
        amount,
        provider,
        currency,
        native_amount,
        status,
        credited_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'credited', NOW())
      ON CONFLICT (payment_id) DO NOTHING
      RETURNING id, amount`,
      [referrerId, userId, paymentId, earningAmount, provider, currency, nativeAmount]
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

    // 6. Update referrer's balance atomically (currency-specific)
    if (currency === 'TON') {
      await query(
        `UPDATE referral_balances
         SET balance_ton = balance_ton + $1,
             earned_ton = earned_ton + $1
         WHERE user_id = $2`,
        [earningAmount, referrerId]
      )
    } else {
      // RUB
      await query(
        `UPDATE referral_balances
         SET balance = balance + $1,
             balance_rub = balance_rub + $1,
             earned_rub = earned_rub + $1
         WHERE user_id = $2`,
        [earningAmount, referrerId]
      )
    }

    const currencySymbol = currency === 'TON' ? 'TON' : '₽'
    console.log(
      `[Referral] ✅ Credited ${earningAmount.toFixed(currency === 'TON' ? 6 : 2)} ${currencySymbol} to referrer ${referrerId} ` +
      `(${commissionRate * 100}% of ${nativeAmount.toFixed(currency === 'TON' ? 6 : 2)} ${currencySymbol} from ${provider} payment ${paymentId})`
    )

    return {
      success: true,
      credited: earningAmount,
      creditedCurrency: currency,
      nativeAmount,
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
 * @returns Earnings breakdown by provider, currency, and totals
 */
export async function getReferralEarningsSummary(referrerId: number) {
  // Get earnings by provider and currency (only credited)
  const result = await query(
    `SELECT
      provider,
      currency,
      status,
      COUNT(*) as earnings_count,
      SUM(amount) as total_amount,
      SUM(native_amount) as total_native
     FROM referral_earnings
     WHERE referrer_id = $1
     GROUP BY provider, currency, status`,
    [referrerId]
  )

  // Get balance info
  const balanceResult = await query(
    `SELECT
      balance_rub,
      balance_ton,
      earned_rub,
      earned_ton,
      withdrawn_rub,
      withdrawn_ton
     FROM referral_balances
     WHERE user_id = $1`,
    [referrerId]
  )

  const balance = balanceResult.rows[0] || {
    balance_rub: 0,
    balance_ton: 0,
    earned_rub: 0,
    earned_ton: 0,
    withdrawn_rub: 0,
    withdrawn_ton: 0,
  }

  // Group by provider/currency, separate by status
  const byProviderCurrency: Record<string, {
    provider: string
    currency: string
    credited: number
    pending: number
    cancelled: number
    total: number
    totalNative: number
  }> = {}

  for (const row of result.rows) {
    const key = `${row.provider}_${row.currency}`
    if (!byProviderCurrency[key]) {
      byProviderCurrency[key] = {
        provider: row.provider,
        currency: row.currency,
        credited: 0,
        pending: 0,
        cancelled: 0,
        total: 0,
        totalNative: 0
      }
    }

    const amount = parseFloat(row.total_amount)
    const native = parseFloat(row.total_native || row.total_amount)

    if (row.status === 'credited' || row.status === 'confirmed') {
      byProviderCurrency[key].credited += amount
      byProviderCurrency[key].total += amount
      byProviderCurrency[key].totalNative += native
    } else if (row.status === 'pending') {
      byProviderCurrency[key].pending += amount
    } else if (row.status === 'cancelled') {
      byProviderCurrency[key].cancelled += amount
    }
  }

  const totalCount = result.rows.reduce((sum, row) => sum + parseInt(row.earnings_count), 0)
  const pendingCount = result.rows
    .filter(r => r.status === 'pending')
    .reduce((sum, row) => sum + parseInt(row.earnings_count), 0)

  return {
    byProviderCurrency,
    balances: {
      rub: {
        available: parseFloat(balance.balance_rub),
        earned: parseFloat(balance.earned_rub),
        withdrawn: parseFloat(balance.withdrawn_rub),
      },
      ton: {
        available: parseFloat(balance.balance_ton),
        earned: parseFloat(balance.earned_ton),
        withdrawn: parseFloat(balance.withdrawn_ton),
      },
    },
    total: {
      count: totalCount,
      pendingCount,
    }
  }
}

/**
 * Get all earnings for a referrer with pagination
 *
 * @param referrerId - The referrer's user ID
 * @param limit - Maximum number of records
 * @param offset - Offset for pagination
 * @param statusFilter - Optional status filter ('pending', 'credited', 'cancelled')
 */
export async function getReferralEarnings(
  referrerId: number,
  limit = 50,
  offset = 0,
  statusFilter?: 'pending' | 'credited' | 'cancelled'
) {
  const statusClause = statusFilter ? 'AND re.status = $4' : ''
  const params = statusFilter
    ? [referrerId, limit, offset, statusFilter]
    : [referrerId, limit, offset]

  const result = await query(
    `SELECT
      re.id,
      re.amount,
      re.provider,
      re.currency,
      re.native_amount,
      re.status,
      re.created_at,
      re.credited_at,
      re.cancelled_at,
      re.cancelled_reason,
      re.referred_user_id,
      re.generation_job_id,
      u.telegram_username as referred_username,
      p.payment_id,
      p.telegram_charge_id,
      p.ton_tx_hash,
      p.amount as payment_amount,
      p.stars_amount,
      p.ton_amount
     FROM referral_earnings re
     LEFT JOIN users u ON u.id = re.referred_user_id
     LEFT JOIN payments p ON p.id = re.payment_id
     WHERE re.referrer_id = $1 ${statusClause}
     ORDER BY re.created_at DESC
     LIMIT $2 OFFSET $3`,
    params
  )

  return result.rows.map(row => ({
    id: row.id,
    amount: parseFloat(row.amount),
    currency: row.currency || 'RUB',
    nativeAmount: parseFloat(row.native_amount || row.amount),
    provider: row.provider,
    status: row.status,
    createdAt: row.created_at,
    creditedAt: row.credited_at,
    cancelledAt: row.cancelled_at,
    cancelledReason: row.cancelled_reason,
    referredUserId: row.referred_user_id,
    referredUsername: row.referred_username,
    generationJobId: row.generation_job_id,
    providerPaymentId: row.payment_id || row.telegram_charge_id || row.ton_tx_hash,
    paymentAmount: parseFloat(row.payment_amount),
    paymentStars: row.stars_amount ? parseInt(row.stars_amount) : null,
    paymentTon: row.ton_amount ? parseFloat(row.ton_amount) : null,
  }))
}

/**
 * Get pending earnings count for a referrer
 * Useful for showing "X earnings pending generation"
 */
export async function getPendingEarningsCount(referrerId: number): Promise<number> {
  const result = await query(
    `SELECT COUNT(*) as count
     FROM referral_earnings
     WHERE referrer_id = $1 AND status = 'pending'`,
    [referrerId]
  )
  return parseInt(result.rows[0]?.count || '0')
}

/**
 * Check if a payment has an earning and its status
 */
export async function getEarningByPaymentId(paymentId: number) {
  const result = await query(
    `SELECT id, referrer_id, amount, currency, status, credited_at, cancelled_at
     FROM referral_earnings
     WHERE payment_id = $1`,
    [paymentId]
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    id: row.id,
    referrerId: row.referrer_id,
    amount: parseFloat(row.amount),
    currency: row.currency,
    status: row.status,
    creditedAt: row.credited_at,
    cancelledAt: row.cancelled_at,
  }
}
