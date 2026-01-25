import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const runtime = 'edge'

// GET /api/user/pending-generation?telegram_user_id=XXX
// Check if user has pending generation after successful payment
export async function GET(request: NextRequest) {
  const telegramUserId = request.nextUrl.searchParams.get("telegram_user_id")

  if (!telegramUserId) {
    return NextResponse.json({ error: "telegram_user_id is required" }, { status: 400 })
  }

  const tgId = parseInt(telegramUserId, 10)
  if (isNaN(tgId)) {
    return NextResponse.json({ error: "Invalid telegram_user_id" }, { status: 400 })
  }

  try {
    // Check if user has pending generation AND a successful payment
    const result = await sql`
      SELECT
        u.pending_generation_tier,
        u.pending_generation_avatar_id,
        u.pending_generation_at,
        EXISTS (
          SELECT 1 FROM payments p
          WHERE p.user_id = u.id AND p.status = 'succeeded'
          ORDER BY p.created_at DESC
          LIMIT 1
        ) as has_successful_payment
      FROM users u
      WHERE u.telegram_user_id = ${tgId}
    `

    if (result.length === 0) {
      return NextResponse.json({ hasPending: false })
    }

    const user = result[0]

    // Only return pending if:
    // 1. There's a pending_generation_tier set
    // 2. User has at least one successful payment
    // 3. pending_generation_at is within last 24 hours (prevent stale data)
    const hasPending = !!(
      user.pending_generation_tier &&
      user.has_successful_payment &&
      user.pending_generation_at &&
      new Date(user.pending_generation_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
    )

    if (hasPending) {
      return NextResponse.json({
        hasPending: true,
        tier: user.pending_generation_tier,
        avatarId: user.pending_generation_avatar_id,
      })
    }

    return NextResponse.json({ hasPending: false })
  } catch (error) {
    console.error("[Pending Generation] Error:", error)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }
}

// DELETE /api/user/pending-generation - Clear pending generation after it starts
export async function DELETE(request: NextRequest) {
  const telegramUserId = request.nextUrl.searchParams.get("telegram_user_id")

  if (!telegramUserId) {
    return NextResponse.json({ error: "telegram_user_id is required" }, { status: 400 })
  }

  const tgId = parseInt(telegramUserId, 10)
  if (isNaN(tgId)) {
    return NextResponse.json({ error: "Invalid telegram_user_id" }, { status: 400 })
  }

  try {
    await sql`
      UPDATE users
      SET
        pending_generation_tier = NULL,
        pending_generation_avatar_id = NULL,
        pending_generation_at = NULL
      WHERE telegram_user_id = ${tgId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Pending Generation] Clear error:", error)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }
}
