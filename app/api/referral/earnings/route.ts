import { NextRequest, NextResponse } from "next/server"
import { query, ReferralEarning } from "@/lib/db"

// GET: Get earnings history
export async function GET(request: NextRequest) {
  try {
    const deviceId = request.nextUrl.searchParams.get("device_id")
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20")
    const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0")

    if (!deviceId) {
      return NextResponse.json({ error: "device_id required" }, { status: 400 })
    }

    // Get user
    const userResult = await query<{ id: number }>(
      "SELECT id FROM users WHERE device_id = $1",
      [deviceId]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userId = userResult.rows[0].id

    // Get earnings with pagination
    const earningsResult = await query<ReferralEarning>(
      `SELECT * FROM referral_earnings
       WHERE referrer_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    )

    // Get total count
    const countResult = await query<{ count: number }>(
      "SELECT COUNT(*) as count FROM referral_earnings WHERE referrer_id = $1",
      [userId]
    )

    return NextResponse.json({
      success: true,
      earnings: earningsResult.rows.map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        originalAmount: Number(e.original_amount),
        date: e.created_at,
      })),
      total: Number(countResult.rows[0]?.count || 0),
      limit,
      offset,
    })
  } catch (error) {
    console.error("Earnings history error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
