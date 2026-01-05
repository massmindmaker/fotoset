/**
 * Cron Job: Monitor TON blockchain for pending payments
 *
 * Runs every 2 minutes via Vercel Cron or external scheduler
 *
 * Process:
 * 1. Query pending TON payments from database
 * 2. Check TON blockchain for matching transactions (via TON Center API)
 * 3. Process confirmed transactions with processWebhook()
 * 4. Credit referral earnings for successful payments
 * 5. Expire old payments past rate_expires_at
 *
 * Security: Requires CRON_SECRET header verification
 */

import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { tonProvider } from "@/lib/payments/providers/ton"
import { processReferralEarning } from "@/lib/referral-earnings"

// Vercel Cron configuration
export const dynamic = "force-dynamic"
export const maxDuration = 60

// TON Center API configuration
const TON_CENTER_API_URL = "https://toncenter.com/api/v2"
const TON_CENTER_API_KEY = process.env.TON_CENTER_API_KEY // Optional, increases rate limits

// How many transactions to check per wallet query
const TRANSACTION_LIMIT = 100

// Minimum confirmations to consider a transaction valid (from TonProvider)
const REQUIRED_CONFIRMATIONS = 10

export async function GET(request: Request) {
  // Verify cron secret (REQUIRED for security)
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[TON Monitor] CRON_SECRET not configured - rejecting request")
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.log("[TON Monitor] Unauthorized request - invalid CRON_SECRET")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  console.log("[TON Monitor] Starting TON blockchain monitoring...")

  try {
    // Step 1: Get our wallet address from settings
    const walletAddress = await getWalletAddress()
    if (!walletAddress) {
      console.log("[TON Monitor] TON wallet not configured, skipping")
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "TON wallet not configured"
      })
    }

    // Step 2: Get pending TON payments
    const pendingPayments = await sql`
      SELECT
        id,
        user_id,
        provider_payment_id,
        ton_amount,
        ton_tx_hash,
        ton_confirmations,
        rate_expires_at,
        created_at
      FROM payments
      WHERE provider = 'ton'
        AND status IN ('pending', 'processing')
      ORDER BY created_at DESC
      LIMIT 50
    `

    if (pendingPayments.length === 0) {
      console.log("[TON Monitor] No pending TON payments")

      // Still expire old payments
      const expired = await tonProvider.expireOldPayments()

      return NextResponse.json({
        success: true,
        pendingPayments: 0,
        processedPayments: 0,
        expiredPayments: expired,
        elapsedMs: Date.now() - startTime,
      })
    }

    console.log(`[TON Monitor] Found ${pendingPayments.length} pending TON payments`)

    // Step 3: Query TON blockchain for recent transactions
    const transactions = await getWalletTransactions(walletAddress)
    console.log(`[TON Monitor] Retrieved ${transactions.length} transactions from TON blockchain`)

    // Step 4: Match transactions with pending payments
    let processed = 0
    let failed = 0
    let stillPending = 0

    for (const payment of pendingPayments) {
      const paymentComment = payment.provider_payment_id // Format: PG{payment_id}

      // Try to find matching transaction
      const matchingTx = findMatchingTransaction(
        transactions,
        payment.ton_amount,
        paymentComment
      )

      if (matchingTx) {
        console.log(`[TON Monitor] Found matching transaction for payment ${payment.id}:`, {
          txHash: matchingTx.hash,
          amount: matchingTx.amount,
          confirmations: matchingTx.confirmations,
          comment: matchingTx.comment,
        })

        try {
          // Process webhook with transaction data
          const webhookResult = await tonProvider.processWebhook({
            txHash: matchingTx.hash,
            amount: matchingTx.amount,
            senderAddress: matchingTx.senderAddress,
            comment: matchingTx.comment,
            confirmations: matchingTx.confirmations,
          })

          if (webhookResult.success) {
            processed++

            // If payment is succeeded (enough confirmations), process referral earning
            if (matchingTx.confirmations >= REQUIRED_CONFIRMATIONS) {
              const referralResult = await processReferralEarning(payment.id, payment.user_id)

              if (referralResult.success && referralResult.credited) {
                console.log(
                  `[TON Monitor] ✓ Credited ${referralResult.credited} RUB referral ` +
                  `to referrer ${referralResult.referrerId} for payment ${payment.id}`
                )
              }
            }
          } else {
            console.warn(`[TON Monitor] Failed to process webhook for payment ${payment.id}:`, webhookResult.error)
            failed++
          }
        } catch (error) {
          console.error(`[TON Monitor] Error processing payment ${payment.id}:`, error)
          failed++
        }
      } else {
        // No matching transaction found yet
        stillPending++
      }

      // Check if we're running out of time (leave 10s buffer)
      if (Date.now() - startTime > 50000) {
        console.log("[TON Monitor] Approaching timeout, stopping early")
        break
      }
    }

    // Step 5: Expire old payments with expired exchange rates
    const expiredCount = await tonProvider.expireOldPayments()
    if (expiredCount > 0) {
      console.log(`[TON Monitor] Expired ${expiredCount} old TON payments`)
    }

    const elapsed = Date.now() - startTime
    console.log(
      `[TON Monitor] Done in ${elapsed}ms: ` +
      `${processed} processed, ${failed} failed, ${stillPending} still pending, ${expiredCount} expired`
    )

    return NextResponse.json({
      success: true,
      pendingPayments: pendingPayments.length,
      processedPayments: processed,
      failedPayments: failed,
      stillPendingPayments: stillPending,
      expiredPayments: expiredCount,
      elapsedMs: elapsed,
    })

  } catch (error) {
    console.error("[TON Monitor] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

/**
 * Get TON wallet address from admin settings
 */
async function getWalletAddress(): Promise<string | null> {
  try {
    const [setting] = await sql`
      SELECT value FROM admin_settings WHERE key = 'payment_methods'
    `.catch(() => [null])

    return setting?.value?.ton?.walletAddress || null
  } catch {
    return null
  }
}

/**
 * Fetch recent transactions for a TON wallet
 * Uses TON Center API v2
 */
async function getWalletTransactions(walletAddress: string): Promise<TonTransaction[]> {
  try {
    const url = new URL(`${TON_CENTER_API_URL}/getTransactions`)
    url.searchParams.set('address', walletAddress)
    url.searchParams.set('limit', TRANSACTION_LIMIT.toString())

    if (TON_CENTER_API_KEY) {
      url.searchParams.set('api_key', TON_CENTER_API_KEY)
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`TON Center API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()

    if (!data.ok || !data.result) {
      throw new Error(`TON Center API returned error: ${JSON.stringify(data)}`)
    }

    // Parse transactions into our format
    const transactions: TonTransaction[] = []

    for (const tx of data.result) {
      // Only process incoming transactions
      if (!tx.in_msg || !tx.in_msg.value) continue

      // Extract amount (convert from nanotons to TON)
      const amountNano = parseInt(tx.in_msg.value, 10)
      const amount = amountNano / 1_000_000_000 // 1 TON = 10^9 nanotons

      // Extract comment from message body
      let comment = ''
      if (tx.in_msg.message) {
        try {
          // TON comments are typically base64 encoded
          const decoded = Buffer.from(tx.in_msg.message, 'base64').toString('utf-8')
          comment = decoded.replace(/\0/g, '').trim() // Remove null bytes
        } catch {
          // If decode fails, use raw message
          comment = tx.in_msg.message || ''
        }
      }

      // Get sender address
      const senderAddress = tx.in_msg.source || 'unknown'

      // Transaction hash
      const hash = tx.transaction_id?.hash || `${tx.transaction_id?.lt || 'unknown'}`

      // Calculate confirmations (approximate based on transaction age)
      // TON finalizes blocks very quickly (~5 seconds), so we can assume
      // transactions older than 1 minute have enough confirmations
      const txTime = tx.utime || 0
      const now = Math.floor(Date.now() / 1000)
      const ageSeconds = now - txTime
      const confirmations = ageSeconds > 60 ? REQUIRED_CONFIRMATIONS : Math.floor(ageSeconds / 5)

      transactions.push({
        hash,
        amount,
        senderAddress,
        comment,
        confirmations,
        timestamp: txTime,
      })
    }

    return transactions

  } catch (error) {
    console.error("[TON Monitor] Error fetching transactions from TON Center:", error)
    return []
  }
}

/**
 * Find a transaction matching the payment
 *
 * Matching criteria:
 * 1. Comment contains payment ID (format: PG{payment_id})
 * 2. Amount matches expected amount (within 1% tolerance for fees)
 */
function findMatchingTransaction(
  transactions: TonTransaction[],
  expectedAmount: number,
  paymentComment: string
): TonTransaction | null {
  const tolerance = expectedAmount * 0.01 // 1% tolerance

  for (const tx of transactions) {
    // Check if comment matches
    if (tx.comment && tx.comment.includes(paymentComment)) {
      // Check if amount matches (within tolerance)
      const amountDiff = Math.abs(tx.amount - expectedAmount)
      if (amountDiff <= tolerance) {
        return tx
      }
    }
  }

  return null
}

/**
 * TON transaction interface
 */
interface TonTransaction {
  hash: string
  amount: number
  senderAddress: string
  comment: string
  confirmations: number
  timestamp: number
}
