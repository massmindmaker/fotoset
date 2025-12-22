import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

// GET: Get earnings history
export async function GET(request: NextRequest) {
  try {
    const telegramUserIdParam = request.nextUrl.searchParams.get("telegram_user_id")
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20")
    const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0")

    if (!telegramUserIdParam) {
      return NextResponse.json({ error: "telegram_user_id required" }, { status: 400 })
    }

    const telegramUserId = parseInt(telegramUserIdParam)
    if (isNaN(telegramUserId)) {
      return NextResponse.json({ error: "Invalid telegram_user_id" }, { status: 400 })
    }

    // Get user by telegram_user_id
    const user = await sql`
      SELECT id FROM users WHERE telegram_user_id = ${telegramUserId}
    `.then((rows: any[]) => rows[0])

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userId = user.id

    // Get earnings with pagination
    const earningsResult = await sql`
      SELECT * FROM referral_earnings
      WHERE referrer_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as count FROM referral_earnings WHERE referrer_id = ${userId}
    `.then((rows: any[]) => rows[0])

    return NextResponse.json({
      success: true,
      earnings: earningsResult.map((e: any) => ({
        id: e.id,
        amount: Number(e.amount),
        originalAmount: Number(e.original_amount),
        date: e.created_at,
      })),
      total: Number(countResult?.count || 0),
      limit,
      offset,
    })
  } catch (error) {
    console.error("[Referral] Earnings error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
