import { type NextRequest, NextResponse } from "next/server"
import { sql, query } from "@/lib/db"
import { initPayment, IS_TEST_MODE, HAS_CREDENTIALS, type PaymentMethod, type Receipt } from "@/lib/tbank"
import { findOrCreateUser } from "@/lib/user-identity"

// Pricing tiers matching frontend (components/views/dashboard-view.tsx)
// TODO: Restore original values after testing (7, 15, 23)
const TIER_PRICES: Record<string, { price: number; photos: number }> = {
  starter: { price: 499, photos: 2 },    // Original: 7
  standard: { price: 999, photos: 5 },   // Original: 15
  premium: { price: 1499, photos: 8 },   // Original: 23
}

export async function POST(request: NextRequest) {
  try {
    const { deviceId, telegramUserId, email, paymentMethod, tierId, photoCount, referralCode } = await request.json() as {
      deviceId?: string
      telegramUserId?: number
      email?: string
      paymentMethod?: PaymentMethod
      tierId?: string
      photoCount?: number
      referralCode?: string
    }

    // SECURITY: Require at least one identifier
    if (!telegramUserId && (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0)) {
      return NextResponse.json({ error: "telegramUserId or deviceId required" }, { status: 400 })
    }
    if (deviceId && deviceId.length > 255) {
      return NextResponse.json({ error: "Device ID too long" }, { status: 400 })
    }

    // Find or create user with priority: telegram_user_id > device_id
    const user = await findOrCreateUser({ telegramUserId, deviceId })

    // Apply referral code if provided and not already applied
    if (referralCode) {
      await applyReferralCode(user.id, referralCode)
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
    if (telegramUserId) {
      successUrlObj.searchParams.set('telegram_user_id', String(telegramUserId))
    } else if (deviceId) {
      successUrlObj.searchParams.set('device_id', deviceId)
    }
    const successUrl = successUrlObj.toString()
    const failUrl = `${baseUrl}/payment/fail`
    const notificationUrl = `${baseUrl}/api/payment/webhook`

    // Generate unique OrderId (T-Bank requires max 20 chars, alphanumeric + underscore)
    // Format: u{userId}t{timestamp_base36} = max ~18 chars
    const timestamp = Date.now().toString(36) // 8 chars in base36
    const orderId = `u${user.id}t${timestamp}`.slice(0, 20)

    // Create Receipt for fiscal check (54-ФЗ)
    const receipt: Receipt = {
      Email: email.trim(),
      Taxation: "usn_income_outcome", // УСН Доходы-Расходы
      Items: [{
        Name: `PinGlass - ${tier.photos} AI фото`,
        Price: amount * 100, // в копейках
        Quantity: 1,
        Amount: amount * 100, // в копейках
        Tax: "none", // без НДС для УСН
        PaymentMethod: "full_payment",
        PaymentObject: "service",
      }],
    }

    console.log("[Payment] Creating T-Bank payment:", {
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
    const payment = await initPayment(
      amount, // dynamic amount based on tier
      orderId,
      `PinGlass - ${tier.photos} AI Photos (${tierId || 'premium'})`,
      successUrl,
      failUrl,
      notificationUrl,
      email,
      paymentMethod,
      receipt, // Receipt for fiscal check
    )

    // Save payment to DB with deviceId for callback lookup
    // NOTE: Using tbank_payment_id column for backward compatibility (stores T-Bank payment ID)
    await sql`
      INSERT INTO payments (user_id, tbank_payment_id, amount, status)
      VALUES (${user.id}, ${payment.PaymentId}, ${amount}, 'pending')
    `

    // Also store the mapping for success page redirect
    await sql`
      UPDATE users SET updated_at = NOW() WHERE id = ${user.id}
    `.catch(() => {}) // Non-critical

    console.log("[Payment] Created successfully:", {
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
      deviceId: deviceId || user.device_id, // Return for client-side storage
    })
  } catch (error) {
    console.error("Payment creation error:", error)
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

    // Create referral
    await query(
      "INSERT INTO referrals (referrer_id, referred_id, referral_code) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [referrerId, userId, code.toUpperCase()]
    )

    // Update referrer count
    await query(
      `INSERT INTO referral_balances (user_id, referrals_count)
       VALUES ($1, 1)
       ON CONFLICT (user_id) DO UPDATE SET
         referrals_count = referral_balances.referrals_count + 1,
         updated_at = NOW()`,
      [referrerId]
    )

    console.log(`[Referral] Applied code ${code} for user ${userId}, referrer: ${referrerId}`)
  } catch (error) {
    console.error("[Referral] Error applying code:", error)
  }
}
