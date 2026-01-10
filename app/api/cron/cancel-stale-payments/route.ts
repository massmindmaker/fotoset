// Cron Job: Cancel stale pending payments
// Runs every 5 minutes via Vercel Cron
//
// A payment is considered "stale" if:
// - Status is 'pending' AND
// - Created more than 5 minutes ago AND
// - Has a tbank_payment_id (meaning it was initiated with T-Bank)
//
// Action: Mark as 'expired' in DB (T-Bank auto-cancels unpaid payments)

import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getPaymentState } from "@/lib/tbank"
import { processReferralEarning } from "@/lib/referral-earnings"

// Vercel Cron configuration
export const dynamic = "force-dynamic"
export const maxDuration = 60

// How long before a pending payment is considered stale (in minutes)
const STALE_THRESHOLD_MINUTES = 5

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  // CRON_SECRET is REQUIRED for security
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET not configured - rejecting request")
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.log("[Cron] Unauthorized request - invalid CRON_SECRET")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("[Cron] Starting stale payment check...")

  try {
    // Find stale pending payments:
    // - Status is 'pending'
    // - Created more than STALE_THRESHOLD_MINUTES ago
    // - Only for tbank provider (Stars and TON have different flows)
    const stalePayments = await sql`
      SELECT
        p.id,
        p.tbank_payment_id,
        p.provider,
        p.amount,
        p.user_id,
        p.created_at,
        EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 60 as minutes_since_created
      FROM payments p
      WHERE p.status = 'pending'
        AND p.created_at < NOW() - INTERVAL '5 minutes'
        AND COALESCE(p.provider, 'tbank') = 'tbank'
      ORDER BY p.created_at ASC
      LIMIT 100
    `

    console.log(`[Cron] Found ${stalePayments.length} stale pending payments`)

    const results: {
      paymentId: string
      userId: number
      minutesOld: number
      action: string
    }[] = []

    for (const payment of stalePayments) {
      console.log(`[Cron] Checking stale payment:`, {
        id: payment.id,
        tbankPaymentId: payment.tbank_payment_id,
        userId: payment.user_id,
        minutesOld: Math.round(payment.minutes_since_created),
        amount: payment.amount,
      })

      try {
        // CRITICAL: Check T-Bank status before marking as expired
        // This prevents losing payments that were actually completed
        let action = 'expired'

        if (payment.tbank_payment_id) {
          try {
            const tbankState = await getPaymentState(payment.tbank_payment_id)
            console.log(`[Cron] T-Bank status for ${payment.tbank_payment_id}: ${tbankState.Status}`)

            if (tbankState.Status === 'CONFIRMED' || tbankState.Status === 'AUTHORIZED') {
              // Payment was actually successful! Update to succeeded
              await sql`
                UPDATE payments
                SET
                  status = 'succeeded',
                  updated_at = NOW()
                WHERE id = ${payment.id}
              `
              action = 'confirmed_by_tbank'

              // Process referral earning for recovered payment
              await processReferralEarning(payment.id, payment.user_id)
              console.log(`[Cron] Payment ${payment.id} recovered - marked as succeeded (was ${tbankState.Status} in T-Bank)`)
            } else if (tbankState.Status === 'REJECTED' || tbankState.Status === 'CANCELED' || tbankState.Status === 'DEADLINE_EXPIRED') {
              // Payment definitely failed, safe to expire
              await sql`
                UPDATE payments
                SET
                  status = 'expired',
                  updated_at = NOW()
                WHERE id = ${payment.id}
              `
              action = 'expired'
              console.log(`[Cron] Payment ${payment.id} marked as expired (T-Bank: ${tbankState.Status})`)
            } else {
              // Still processing at T-Bank, skip for now
              action = 'skipped_still_processing'
              console.log(`[Cron] Payment ${payment.id} still processing at T-Bank (${tbankState.Status}), skipping`)
            }
          } catch (tbankErr) {
            // T-Bank API error - expire as fallback (conservative approach)
            console.warn(`[Cron] T-Bank API error for ${payment.tbank_payment_id}:`, tbankErr)
            await sql`
              UPDATE payments
              SET
                status = 'expired',
                updated_at = NOW()
              WHERE id = ${payment.id}
            `
            action = 'expired_tbank_error'
          }
        } else {
          // No T-Bank payment ID, just expire
          await sql`
            UPDATE payments
            SET
              status = 'expired',
              updated_at = NOW()
            WHERE id = ${payment.id}
          `
        }

        results.push({
          paymentId: payment.tbank_payment_id || payment.id.toString(),
          userId: payment.user_id,
          minutesOld: Math.round(payment.minutes_since_created),
          action,
        })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error"
        console.error(`[Cron] Failed to process payment ${payment.id}:`, errorMsg)

        results.push({
          paymentId: payment.tbank_payment_id || payment.id.toString(),
          userId: payment.user_id,
          minutesOld: Math.round(payment.minutes_since_created),
          action: `error: ${errorMsg}`,
        })
      }
    }

    return NextResponse.json({
      success: true,
      checked: stalePayments.length,
      expired: results.filter(r => r.action === "expired").length,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Cron] Failed to check stale payments:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
