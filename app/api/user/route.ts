import { type NextRequest, NextResponse } from "next/server"
import { findOrCreateUser } from "@/lib/user-identity"
import { sql } from "@/lib/db"
import { trackReferralApplied } from "@/lib/sentry-events"

/**
 * POST /api/user
 *
 * TELEGRAM WEBAPP AUTHENTICATION
 * - Accepts telegramUserId from Telegram WebApp SDK (initDataUnsafe.user.id)
 * - Creates or returns existing user
 * - Optionally saves referral code to pending_referral_code field
 * - markOnboardingComplete: increments referrer's count when user finishes onboarding
 *
 * NOTE: In Telegram WebApp context, we trust initDataUnsafe.user.id
 * because the app is only accessible through Telegram
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { telegramUserId, telegramUsername, referralCode, markOnboardingComplete } = body as {
      telegramUserId?: number
      telegramUsername?: string
      referralCode?: string
      markOnboardingComplete?: boolean
    }

    // Require telegramUserId
    if (!telegramUserId || typeof telegramUserId !== "number") {
      return NextResponse.json(
        { error: "telegramUserId is required" },
        { status: 400 }
      )
    }

    // Find or create user (with optional referral code and username)
    const user = await findOrCreateUser({
      telegramUserId,
      telegramUsername: telegramUsername || undefined,
      referralCode: referralCode || undefined,
    })

    console.log(`[User API] User ${user.id}:`, {
      telegramUserId: user.telegram_user_id,
      telegramUsername: user.telegram_username || "none",
      pendingReferralCode: user.pending_referral_code || "none",
      markOnboardingComplete,
    })

    // Handle onboarding completion - increment referrer's count and create referral link
    if (markOnboardingComplete) {
      // Check if not already completed
      const checkResult = await sql`
        SELECT onboarding_completed_at FROM users WHERE id = ${user.id}
      `

      if (!checkResult[0]?.onboarding_completed_at) {
        // Mark onboarding as complete
        await sql`
          UPDATE users SET onboarding_completed_at = NOW() WHERE id = ${user.id}
        `
        console.log(`[User API] Onboarding completed for user ${user.id}`)

        // Process referral if user has pending referral code
        if (user.pending_referral_code) {
          const referrerResult = await sql`
            SELECT u.id FROM users u
            JOIN referral_codes rc ON rc.user_id = u.id
            WHERE UPPER(rc.code) = UPPER(${user.pending_referral_code})
          `

          if (referrerResult.length > 0) {
            const referrerId = referrerResult[0].id

            // Check if referral link already exists (idempotent)
            const existingReferral = await sql`
              SELECT id FROM referrals WHERE referred_id = ${user.id}
            `

            if (existingReferral.length === 0) {
              // Create referral link in referrals table (for webhook to find referrer)
              await sql`
                INSERT INTO referrals (referrer_id, referred_id)
                VALUES (${referrerId}, ${user.id})
                ON CONFLICT DO NOTHING
              `
              console.log(`[User API] Created referral link: ${referrerId} -> ${user.id}`)

              // Increment referrer's referrals_count atomically
              await sql`
                INSERT INTO referral_balances (user_id, referrals_count, balance)
                VALUES (${referrerId}, 1, 0)
                ON CONFLICT (user_id)
                DO UPDATE SET referrals_count = referral_balances.referrals_count + 1
              `
              console.log(`[User API] +1 referral count for user ${referrerId} (referrer of ${user.id})`)
              trackReferralApplied(user.id, referrerId)
            } else {
              console.log(`[User API] Referral link already exists for user ${user.id}`)
            }
          }
        }
      }
    }

    return NextResponse.json({
      id: user.id,
      telegramUserId: user.telegram_user_id,
      pendingReferralCode: user.pending_referral_code,
    })
  } catch (error) {
    console.error("[User API] Error:", error)
    return NextResponse.json(
      { error: "Failed to get/create user" },
      { status: 500 }
    )
  }
}
