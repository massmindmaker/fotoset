/**
 * Universal Referral Earnings Processing
 *
 * Multi-currency support:
 * - T-Bank (RUB): Our system, stored in balance_rub
 * - Stars: Handled by Telegram Affiliate Program (SKIPPED here)
 * - TON: Our system, stored in balance_ton
 *
 * Commission rates:
 * - Regular users: 10%
 * - Partners: 50% (or custom rate)
 */

import { query } from '@/lib/db'

const DEFAULT_REFERRAL_RATE = 0.10 // 10%
const PARTNER_REFERRAL_RATE = 0.50 // 50%

export interface ReferralEarningResult {
  success: boolean
  credited?: number
  creditedCurrency?: 'RUB' | 'TON' | 'STARS'
  nativeAmount?: number
  referrerId?: number
  error?: string
  alreadyProcessed?: boolean
  skippedReason?: string
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

    // 5. Insert earning record (idempotent with ON CONFLICT)
    const insertEarning = await query(
      `INSERT INTO referral_earnings (
        referrer_id,
        referred_user_id,
        payment_id,
        amount,
        provider,
        currency,
        native_amount
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
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
  // Get earnings by provider and currency
  const result = await query(
    `SELECT
      provider,
      currency,
      COUNT(*) as earnings_count,
      SUM(amount) as total_amount,
      SUM(native_amount) as total_native
     FROM referral_earnings
     WHERE referrer_id = $1
     GROUP BY provider, currency`,
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

  const summary = result.rows.reduce((acc, row) => {
    const key = `${row.provider}_${row.currency}`
    acc[key] = {
      provider: row.provider,
      currency: row.currency,
      count: parseInt(row.earnings_count),
      total: parseFloat(row.total_amount),
      totalNative: parseFloat(row.total_native || row.total_amount)
    }
    return acc
  }, {} as Record<string, { provider: string; currency: string; count: number; total: number; totalNative: number }>)

  const totalCount = result.rows.reduce((sum, row) => sum + parseInt(row.earnings_count), 0)

  return {
    byProviderCurrency: summary,
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
      re.currency,
      re.native_amount,
      re.created_at,
      re.referred_user_id,
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
     WHERE re.referrer_id = $1
     ORDER BY re.created_at DESC
     LIMIT $2 OFFSET $3`,
    [referrerId, limit, offset]
  )

  return result.rows.map(row => ({
    id: row.id,
    amount: parseFloat(row.amount),
    currency: row.currency || 'RUB',
    nativeAmount: parseFloat(row.native_amount || row.amount),
    provider: row.provider,
    createdAt: row.created_at,
    referredUserId: row.referred_user_id,
    referredUsername: row.referred_username,
    providerPaymentId: row.payment_id || row.telegram_charge_id || row.ton_tx_hash,
    paymentAmount: parseFloat(row.payment_amount),
    paymentStars: row.stars_amount ? parseInt(row.stars_amount) : null,
    paymentTon: row.ton_amount ? parseFloat(row.ton_amount) : null,
  }))
}
