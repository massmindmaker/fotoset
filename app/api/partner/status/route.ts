import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

/**
 * GET /api/partner/status
 * Check partner status and application status
 * Supports both Telegram users (telegram_user_id) and Web users (neon_user_id)
 */
export async function GET(request: NextRequest) {
  try {
    const telegramUserId = request.nextUrl.searchParams.get("telegram_user_id")
    const neonUserId = request.nextUrl.searchParams.get("neon_user_id")

    if (!telegramUserId && !neonUserId) {
      return NextResponse.json(
        { success: false, error: "telegram_user_id or neon_user_id required" },
        { status: 400 }
      )
    }

    // Get user by telegram_user_id or neon_user_id
    let userResult
    if (neonUserId) {
      userResult = await sql`
        SELECT id FROM users WHERE neon_user_id = ${neonUserId}
      `
    } else {
      userResult = await sql`
        SELECT id FROM users WHERE telegram_user_id = ${parseInt(telegramUserId!)}
      `
    }

    if (userResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }
    const userId = userResult[0].id

    // Get partner status from referral_balances
    const balanceResult = await sql`
      SELECT is_partner, commission_rate, partner_approved_at
      FROM referral_balances
      WHERE user_id = ${userId}
    `

    const isPartner = balanceResult.length > 0 && balanceResult[0].is_partner
    const commissionRate = balanceResult.length > 0
      ? Number(balanceResult[0].commission_rate)
      : 0.10

    // Get latest application status
    const applicationResult = await sql`
      SELECT id, status, rejection_reason, created_at, reviewed_at
      FROM partner_applications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 1
    `

    const application = applicationResult.length > 0
      ? {
          id: applicationResult[0].id,
          status: applicationResult[0].status,
          rejectionReason: applicationResult[0].rejection_reason,
          createdAt: applicationResult[0].created_at,
          reviewedAt: applicationResult[0].reviewed_at,
        }
      : null

    return NextResponse.json({
      success: true,
      isPartner,
      commissionRate,
      commissionPercent: Math.round(commissionRate * 100),
      partnerApprovedAt: balanceResult[0]?.partner_approved_at || null,
      application,
      canApply: !isPartner && (!application || application.status === 'rejected'),
    })
  } catch (error) {
    console.error("[Partner] Status error:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при получении статуса" },
      { status: 500 }
    )
  }
}
