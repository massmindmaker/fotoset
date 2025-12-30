import { type NextRequest, NextResponse } from "next/server"
import { sql, query } from "@/lib/db"
import { initPayment, IS_TEST_MODE, HAS_CREDENTIALS, type PaymentMethod, type Receipt } from "@/lib/tbank"
import { findOrCreateUser } from "@/lib/user-identity"
import { paymentLogger as log } from "@/lib/logger"

// Pricing tiers matching frontend (components/views/dashboard-view.tsx)
const TIER_PRICES: Record<string, { price: number; photos: number }> = {
  starter: { price: 499, photos: 7 },
  standard: { price: 999, photos: 15 },
  premium: { price: 1499, photos: 23 },
}

export async function POST(request: NextRequest) {
  try {
    const { telegramUserId, email, paymentMethod, tierId, photoCount, referralCode, avatarId } = await request.json() as {
      telegramUserId: number
      email?: string
      paymentMethod?: PaymentMethod
      tierId?: string
      photoCount?: number
      referralCode?: string
      avatarId?: string
    }

    // SECURITY: Require telegramUserId (Telegram-only authentication)
    if (!telegramUserId || typeof telegramUserId !== 'number') {
      return NextResponse.json({ error: "telegramUserId is required" }, { status: 400 })
    }

    // Find or create user (Telegram-only)
    const user = await findOrCreateUser({ telegramUserId })

    // CRITICAL: Use pending_referral_code from DATABASE (survives T-Bank redirect)
    // Client referralCode parameter is deprecated but still accepted as fallback
    const effectiveReferralCode = user.pending_referral_code || referralCode

    // Apply referral code if exists and not already applied
    if (effectiveReferralCode) {
      console.log(`[Payment] Applying referral code ${effectiveReferralCode} for user ${user.id} (source: ${user.pending_referral_code ? 'DB' : 'client'})`)
      await applyReferralCode(user.id, effectiveReferralCode)
    } else {
      console.log(`[Payment] No referral code for user ${user.id}`)
    }

    // Check credentials before proceeding
    if (!HAS_CREDENTIALS) {
      return NextResponse.json({
        error: "Payment system not configured. Please contact support."
      }, { status: 503 })
    }

    // CRITICAL: Email is required for 54-ФЗ fiscal receipts
    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({
        error: "Email обязателен для получения электронного чека (54-ФЗ)"
      }, { status: 400 })
    }

    // Validate and get tier pricing
    const tier = TIER_PRICES[tierId || 'premium']
    if (!tier) {
      return NextResponse.json({
        error: "Invalid tier. Use: starter, standard, or premium"
      }, { status: 400 })
    }
    const amount = tier.price

    // Определяем return URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "http://localhost:3000"

    // FIX: Redirect to /payment/callback which polls status and triggers generation
    // /payment/success was a dead-end that didn't trigger generation flow
    // Use URL API for proper encoding of query parameters
    const successUrlObj = new URL(`${baseUrl}/payment/callback`)
    successUrlObj.searchParams.set('telegram_user_id', String(telegramUserId))
    successUrlObj.searchParams.set('tier', tierId || 'premium')
    const successUrl = successUrlObj.toString()
    const failUrl = `${baseUrl}/payment/fail`
    const notificationUrl = `${baseUrl}/api/payment/webhook`

    // Generate unique OrderId (T-Bank requires max 20 chars, alphanumeric + underscore)
    // Format: u{userId}t{timestamp_base36} = max ~18 chars
    const timestamp = Date.now().toString(36) // 8 chars in base36
    const orderId = `u${user.id}t${timestamp}`.slice(0, 20)

    // Create Receipt for fiscal check (54-ФЗ)
    // CRITICAL: Price/Amount in kopeks (rubles * 100)
    // initPayment() already converts amount to kopeks, so Receipt must use same value
    const amountInKopeks = amount * 100
    const receipt: Receipt = {
      Email: email.trim(),
      Taxation: "usn_income_outcome", // УСН Доходы-Расходы
      Items: [{
        Name: `PinGlass - ${tier.photos} AI фото`,
        Price: amountInKopeks, // в копейках (уже умножено на 100)
        Quantity: 1,
        Amount: amountInKopeks, // в копейках (уже умножено на 100)
        Tax: "none", // без НДС для УСН
        PaymentMethod: "full_payment",
        PaymentObject: "service",
      }],
    }

    log.debug(" Creating T-Bank payment:", {
      orderId,
      amount,
      tierId: tierId || 'premium',
      photos: tier.photos,
      email,
      paymentMethod,
      successUrl,
      failUrl,
      notificationUrl,
      testMode: IS_TEST_MODE,
      hasReceipt: true,
    })

    // Create payment via T-Bank API (real API for test terminals too)
    // CRITICAL: Don't pass email as customerEmail when Receipt.Email is present (causes 501)
    const payment = await initPayment(
      amount, // dynamic amount based on tier
      orderId,
      `PinGlass - ${tier.photos} AI Photos (${tierId || 'premium'})`,
      successUrl,
      failUrl,
      notificationUrl,
      undefined, // customerEmail - не нужен, т.к. есть Receipt.Email
      paymentMethod,
      receipt, // Receipt for fiscal check
    )

    // Save payment to DB for callback lookup
    // NOTE: Using tbank_payment_id column for backward compatibility (stores T-Bank payment ID)
    await sql`
      INSERT INTO payments (user_id, tbank_payment_id, amount, status)
      VALUES (${user.id}, ${payment.PaymentId}, ${amount}, 'pending')
    `

    // CRITICAL: Save pending generation params to user record
    // This survives Telegram WebApp redirects (sessionStorage/localStorage don't)
    const avatarIdNum = avatarId ? parseInt(avatarId, 10) : null
    await sql`
      UPDATE users
      SET
        pending_generation_tier = ${tierId || 'premium'},
        pending_generation_avatar_id = ${avatarIdNum},
        pending_generation_at = NOW(),
        updated_at = NOW()
      WHERE id = ${user.id}
    `

    log.debug(" Saved pending generation:", {
      userId: user.id,
      tier: tierId || 'premium',
      avatarId: avatarIdNum,
    })

    log.debug(" Created successfully:", {
      orderId,
      paymentId: payment.PaymentId,
      hasPaymentUrl: !!payment.PaymentURL,
      testMode: IS_TEST_MODE,
    })

    return NextResponse.json({
      paymentId: payment.PaymentId,
      confirmationUrl: payment.PaymentURL,
      testMode: IS_TEST_MODE,
      telegramUserId, // Return for client-side usage
    })
  } catch (error) {
    log.error("Creation error:", error)
    const message = error instanceof Error ? error.message : "Failed to create payment"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Apply referral code (silent, non-blocking)
async function applyReferralCode(userId: number, code: string) {
  try {
    // Check if already referred
    const existing = await query(
      "SELECT id FROM referrals WHERE referred_id = $1",
      [userId]
    )
    if (existing.rows.length > 0) return

    // Find code owner
    const codeResult = await query<{ user_id: number }>(
      "SELECT user_id FROM referral_codes WHERE code = $1 AND is_active = true",
      [code.toUpperCase()]
    )
    if (codeResult.rows.length === 0) return

    const referrerId = codeResult.rows[0].user_id
    if (referrerId === userId) return // Can't refer yourself

    // Create referral link (fallback if not created during onboarding)
    const insertResult = await query<{ id: number }>(
      "INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id",
      [referrerId, userId]
    )

    // Only increment count if we actually created a new referral (not duplicate)
    if (insertResult.rows.length > 0) {
      await query(
        `INSERT INTO referral_balances (user_id, referrals_count, balance)
         VALUES ($1, 1, 0)
         ON CONFLICT (user_id)
         DO UPDATE SET referrals_count = referral_balances.referrals_count + 1`,
        [referrerId]
      )
      log.info(`Applied referral code ${code} for user ${userId}, referrer: ${referrerId} (+1 count)`)
    }
  } catch (error) {
    log.error(" Error applying code:", error)
  }
}
