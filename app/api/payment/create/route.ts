import { type NextRequest, NextResponse } from "next/server"
import { sql, query } from "@/lib/db"
import { initPayment, IS_TEST_MODE, HAS_CREDENTIALS, type PaymentMethod } from "@/lib/tbank"

export async function POST(request: NextRequest) {
  try {
    const { deviceId, email, paymentMethod, tierId, photoCount, referralCode } = await request.json() as {
      deviceId: string
      email?: string
      paymentMethod?: PaymentMethod
      tierId?: string
      photoCount?: number
      referralCode?: string
    }

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID required" }, { status: 400 })
    }

    // Получаем или создаем пользователя
    let user = await sql`
      SELECT * FROM users WHERE device_id = ${deviceId}
    `.then((rows) => rows[0])

    if (!user) {
      user = await sql`
        INSERT INTO users (device_id) VALUES (${deviceId})
        RETURNING *
      `.then((rows) => rows[0])
    }

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

    // Определяем return URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "http://localhost:3000"

    // T-Bank requires clean URLs - pass params via DATA or use dedicated success/fail pages
    const successUrl = `${baseUrl}/payment/success`
    const failUrl = `${baseUrl}/payment/fail`
    const notificationUrl = `${baseUrl}/api/payment/webhook`

    // Generate unique OrderId (T-Bank requires max 20 chars, alphanumeric + underscore)
    // Format: u{userId}t{timestamp_base36} = max ~18 chars
    const timestamp = Date.now().toString(36) // 8 chars in base36
    const orderId = `u${user.id}t${timestamp}`.slice(0, 20)

    console.log("[Payment] Creating T-Bank payment:", {
      orderId,
      amount: 500,
      email,
      paymentMethod,
      successUrl,
      failUrl,
      notificationUrl,
      testMode: IS_TEST_MODE,
    })

    // Create payment via T-Bank API (real API for test terminals too)
    const payment = await initPayment(
      500, // amount in rubles
      orderId,
      "PinGlass Pro - AI Photo Generation",
      successUrl,
      failUrl,
      notificationUrl,
      email,
      paymentMethod,
    )

    // Save payment to DB with deviceId for callback lookup
    await sql`
      INSERT INTO payments (user_id, yookassa_payment_id, amount, status)
      VALUES (${user.id}, ${payment.PaymentId}, 500, 'pending')
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
      deviceId, // Return for client-side storage
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
