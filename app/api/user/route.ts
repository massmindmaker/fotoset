import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  validateTelegramInitData,
  getTelegramDeviceId,
  createUnauthorizedResponse,
  type TelegramInitData,
} from "@/lib/telegram-auth"

/**
 * POST /api/user
 *
 * IDENTITY PRIORITY:
 * 1. telegram_user_id (primary - for cross-device sync)
 * 2. device_id (fallback - for web-only users)
 *
 * SECURITY: Enhanced with Telegram WebApp authentication
 * - Validates telegramInitData if provided
 * - Rejects requests with invalid Telegram auth
 * - Returns deviceId to client for localStorage sync
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceId, telegramInitData } = body

    // Validate Telegram authentication if provided
    let validatedTelegramData: TelegramInitData | null = null
    let telegramUserId: number | null = null

    if (telegramInitData) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN

      if (!botToken) {
        console.error("[User API] TELEGRAM_BOT_TOKEN not configured")
        return NextResponse.json(
          { error: "Telegram authentication not configured" },
          { status: 500 }
        )
      }

      // Validate Telegram initData
      validatedTelegramData = validateTelegramInitData(telegramInitData, botToken)

      if (!validatedTelegramData) {
        console.warn("[User API] Invalid Telegram initData")
        return createUnauthorizedResponse()
      }

      if (!validatedTelegramData.user) {
        console.warn("[User API] No user data in Telegram initData")
        return createUnauthorizedResponse()
      }

      telegramUserId = validatedTelegramData.user.id

      // Use Telegram-based device ID for consistency
      const telegramDeviceId = getTelegramDeviceId(validatedTelegramData.user)

      // PRIORITY 1: Search by telegram_user_id first
      let user = await sql`
        SELECT * FROM users WHERE telegram_user_id = ${telegramUserId}
      `.then((rows) => rows[0])

      if (user) {
        // Found by telegram_user_id - update device_id if different
        if (user.device_id !== telegramDeviceId) {
          user = await sql`
            UPDATE users
            SET device_id = ${telegramDeviceId}, updated_at = NOW()
            WHERE telegram_user_id = ${telegramUserId}
            RETURNING *
          `.then((rows) => rows[0])
          console.log(`[User API] Updated device_id for Telegram user: ${telegramUserId}`)
        }
      } else {
        // Not found by telegram_user_id, check if device_id exists
        const existingDeviceUser = await sql`
          SELECT * FROM users WHERE device_id = ${telegramDeviceId}
        `.then((rows) => rows[0])

        if (existingDeviceUser) {
          // Link telegram_user_id to existing device user
          user = await sql`
            UPDATE users
            SET telegram_user_id = ${telegramUserId}, updated_at = NOW()
            WHERE device_id = ${telegramDeviceId}
            RETURNING *
          `.then((rows) => rows[0])
          console.log(`[User API] Linked Telegram user ${telegramUserId} to existing device`)
        } else {
          // Create new user with both identifiers
          user = await sql`
            INSERT INTO users (device_id, telegram_user_id)
            VALUES (${telegramDeviceId}, ${telegramUserId})
            RETURNING *
          `.then((rows) => rows[0])
          console.log(`[User API] Created new Telegram user: ${telegramUserId}`)
        }
      }

      // Handle case where client provided different deviceId
      // Merge data if old deviceId has data but no telegram_user_id
      if (deviceId && deviceId !== telegramDeviceId) {
        const oldDeviceUser = await sql`
          SELECT id FROM users
          WHERE device_id = ${deviceId}
          AND telegram_user_id IS NULL
          AND id != ${user.id}
        `.then((rows) => rows[0])

        if (oldDeviceUser) {
          // Merge old device user's data into telegram user
          await mergeUsers(oldDeviceUser.id, user.id)
          console.log(`[User API] Merged old device ${deviceId} into Telegram user ${telegramUserId}`)
        }
      }

      return NextResponse.json({
        id: user.id,
        deviceId: user.device_id,
        telegramUserId: user.telegram_user_id,
      })
    }

    // FALLBACK: deviceId-only authentication (non-Telegram clients)
    if (!deviceId) {
      return NextResponse.json(
        { error: "Device ID or Telegram authentication required" },
        { status: 400 }
      )
    }

    // Check existing user by device_id
    let user = await sql`
      SELECT * FROM users WHERE device_id = ${deviceId}
    `.then((rows) => rows[0])

    // Create if not exists
    if (!user) {
      user = await sql`
        INSERT INTO users (device_id, telegram_user_id)
        VALUES (${deviceId}, ${null})
        RETURNING *
      `.then((rows) => rows[0])
      console.log(`[User API] Created new user: ${deviceId}`)
    }

    return NextResponse.json({
      id: user.id,
      deviceId: user.device_id,
      telegramUserId: user.telegram_user_id,
    })
  } catch (error) {
    console.error("[User API] Error:", error)
    return NextResponse.json(
      { error: "Failed to get/create user" },
      { status: 500 }
    )
  }
}

/**
 * Merge source user data into target user, then delete source
 */
async function mergeUsers(sourceUserId: number, targetUserId: number): Promise<void> {
  // Transfer avatars
  await sql`
    UPDATE avatars SET user_id = ${targetUserId}
    WHERE user_id = ${sourceUserId}
  `

  // Transfer payments
  await sql`
    UPDATE payments SET user_id = ${targetUserId}
    WHERE user_id = ${sourceUserId}
  `

  // Transfer referral codes (skip conflicts)
  await sql`
    UPDATE referral_codes SET user_id = ${targetUserId}
    WHERE user_id = ${sourceUserId}
    AND NOT EXISTS (
      SELECT 1 FROM referral_codes rc2
      WHERE rc2.user_id = ${targetUserId}
    )
  `

  // Transfer photo favorites (skip duplicates)
  await sql`
    INSERT INTO photo_favorites (user_id, photo_id, created_at)
    SELECT ${targetUserId}, photo_id, created_at
    FROM photo_favorites
    WHERE user_id = ${sourceUserId}
    AND photo_id NOT IN (
      SELECT photo_id FROM photo_favorites WHERE user_id = ${targetUserId}
    )
  `

  // Merge referral balances
  const sourceBalance = await sql`
    SELECT balance, total_earned, total_withdrawn, referrals_count
    FROM referral_balances WHERE user_id = ${sourceUserId}
  `.then((rows) => rows[0])

  if (sourceBalance) {
    await sql`
      INSERT INTO referral_balances (user_id, balance, total_earned, total_withdrawn, referrals_count)
      VALUES (
        ${targetUserId},
        ${sourceBalance.balance},
        ${sourceBalance.total_earned},
        ${sourceBalance.total_withdrawn},
        ${sourceBalance.referrals_count}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        balance = referral_balances.balance + ${sourceBalance.balance},
        total_earned = referral_balances.total_earned + ${sourceBalance.total_earned},
        total_withdrawn = referral_balances.total_withdrawn + ${sourceBalance.total_withdrawn},
        referrals_count = referral_balances.referrals_count + ${sourceBalance.referrals_count},
        updated_at = NOW()
    `
  }

  // Transfer referrals
  await sql`UPDATE referrals SET referrer_id = ${targetUserId} WHERE referrer_id = ${sourceUserId}`
  await sql`UPDATE referrals SET referred_id = ${targetUserId} WHERE referred_id = ${sourceUserId}`

  // Transfer earnings
  await sql`UPDATE referral_earnings SET referrer_id = ${targetUserId} WHERE referrer_id = ${sourceUserId}`
  await sql`UPDATE referral_earnings SET referred_id = ${targetUserId} WHERE referred_id = ${sourceUserId}`

  // Transfer withdrawals
  await sql`UPDATE referral_withdrawals SET user_id = ${targetUserId} WHERE user_id = ${sourceUserId}`

  // Transfer shared galleries
  await sql`UPDATE shared_galleries SET user_id = ${targetUserId} WHERE user_id = ${sourceUserId}`

  // Delete source user and related data
  await sql`DELETE FROM referral_balances WHERE user_id = ${sourceUserId}`
  await sql`DELETE FROM referral_codes WHERE user_id = ${sourceUserId}`
  await sql`DELETE FROM photo_favorites WHERE user_id = ${sourceUserId}`
  await sql`DELETE FROM users WHERE id = ${sourceUserId}`
}
