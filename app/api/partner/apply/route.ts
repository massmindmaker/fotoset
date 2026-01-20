import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { findOrCreateUser } from "@/lib/user-identity"

/**
 * POST /api/partner/apply
 * Submit partner application for 50% commission rate
 *
 * Supports both Telegram and Web users:
 * - Telegram: identified by telegramUserId
 * - Web: identified by neonUserId
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      telegramUserId,
      neonUserId,
      email,
      contactName,
      contactEmail,
      contactPhone,
      telegramUsername,
      audienceSize,
      audienceType,
      promotionChannels,
      websiteUrl,
      socialLinks,
      message,
      expectedReferrals,
    } = body

    // Validate required fields
    if (!telegramUserId && !neonUserId) {
      return NextResponse.json(
        { success: false, error: "telegramUserId or neonUserId required" },
        { status: 400 }
      )
    }

    if (!contactName?.trim()) {
      return NextResponse.json(
        { success: false, error: "Имя обязательно" },
        { status: 400 }
      )
    }

    // Get or create user (supports both Telegram and Web)
    const user = await findOrCreateUser({
      telegramUserId,
      neonUserId,
      email,
      telegramUsername
    })
    const userId = user.id

    // Check if already a partner
    const partnerCheck = await sql`
      SELECT is_partner FROM referral_balances WHERE user_id = ${userId}
    `
    if (partnerCheck.length > 0 && partnerCheck[0].is_partner) {
      return NextResponse.json(
        { success: false, error: "Вы уже партнёр!" },
        { status: 400 }
      )
    }

    // Check for existing pending application
    const existingApp = await sql`
      SELECT id, status FROM partner_applications
      WHERE user_id = ${userId} AND status = 'pending'
    `
    if (existingApp.length > 0) {
      return NextResponse.json(
        { success: false, error: "У вас уже есть заявка на рассмотрении" },
        { status: 400 }
      )
    }

    // Create application
    const result = await sql`
      INSERT INTO partner_applications (
        user_id,
        contact_name,
        contact_email,
        contact_phone,
        telegram_username,
        audience_size,
        audience_type,
        promotion_channels,
        website_url,
        social_links,
        message,
        expected_referrals,
        status
      ) VALUES (
        ${userId},
        ${contactName.trim()},
        ${contactEmail?.trim() || null},
        ${contactPhone?.trim() || null},
        ${telegramUsername?.replace('@', '').trim() || null},
        ${audienceSize || null},
        ${audienceType || null},
        ${promotionChannels?.trim() || null},
        ${websiteUrl?.trim() || null},
        ${socialLinks ? JSON.stringify(socialLinks) : null},
        ${message?.trim() || null},
        ${expectedReferrals || null},
        'pending'
      )
      RETURNING id
    `

    console.log(`[Partner] New application #${result[0].id} from user ${userId}`)

    return NextResponse.json({
      success: true,
      applicationId: result[0].id,
      message: "Заявка отправлена! Мы рассмотрим её в течение 24 часов.",
    })
  } catch (error) {
    console.error("[Partner] Apply error:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при подаче заявки" },
      { status: 500 }
    )
  }
}
