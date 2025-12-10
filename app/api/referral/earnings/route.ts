import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

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
    const userResult = await sql`
      SELECT id FROM users WHERE device_id = ${deviceId}
    `

    if (userResult.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userId = userResult[0].id

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
    `

    return NextResponse.json({
      success: true,
      earnings: earningsResult.map((e: any) => ({
        id: e.id,
        amount: Number(e.amount),
        originalAmount: Number(e.original_amount),
        date: e.created_at,
      })),
      total: Number(countResult[0]?.count || 0),
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
