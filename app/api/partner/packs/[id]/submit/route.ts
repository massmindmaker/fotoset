import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAuthenticatedUser } from "@/lib/auth-middleware"

/**
 * POST /api/partner/packs/[id]/submit
 * Submit pack for moderation (changes status to pending)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const authUser = await getAuthenticatedUser(request, body)

    if (!authUser) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      )
    }

    // Check if user is partner
    const partnerCheck = await sql`
      SELECT is_partner FROM referral_balances WHERE user_id = ${authUser.user.id}
    `
    if (partnerCheck.length === 0 || !partnerCheck[0].is_partner) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Partner status required" },
        { status: 403 }
      )
    }

    const packId = parseInt(id)
    if (isNaN(packId)) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Invalid pack ID" },
        { status: 400 }
      )
    }

    // Get pack and verify ownership
    const pack = await sql`
      SELECT * FROM photo_packs
      WHERE id = ${packId} AND partner_user_id = ${authUser.user.id}
    `

    if (pack.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Pack not found or access denied" },
        { status: 404 }
      )
    }

    // Check if pack can be submitted
    const moderationStatus = pack[0].moderation_status
    if (moderationStatus !== "draft" && moderationStatus !== "rejected") {
      return NextResponse.json(
        {
          error: "INVALID_STATE",
          message: "Can only submit draft or rejected packs",
        },
        { status: 400 }
      )
    }

    // Validate pack has required prompts (7-23)
    const promptCount = await sql`
      SELECT COUNT(*) as count FROM pack_prompts
      WHERE pack_id = ${packId} AND is_active = TRUE
    `
    const count = parseInt(promptCount[0].count)

    if (count < 7) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: `Pack must have at least 7 prompts (current: ${count})`,
        },
        { status: 400 }
      )
    }

    if (count > 23) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: `Pack cannot have more than 23 prompts (current: ${count})`,
        },
        { status: 400 }
      )
    }

    // Submit pack for moderation
    const result = await sql`
      UPDATE photo_packs
      SET
        moderation_status = 'pending',
        submitted_at = NOW(),
        reviewed_by = NULL,
        reviewed_at = NULL,
        rejection_reason = NULL,
        updated_at = NOW()
      WHERE id = ${packId}
      RETURNING *
    `

    console.log(
      `[Partner Pack] Pack #${packId} submitted for moderation by user ${authUser.user.id} (${count} prompts)`
    )

    return NextResponse.json({
      success: true,
      pack: {
        id: result[0].id,
        name: result[0].name,
        moderationStatus: result[0].moderation_status,
        submittedAt: result[0].submitted_at,
        promptCount: count,
      },
      message: "Pack submitted for moderation. Review usually takes 24-48 hours.",
    })
  } catch (error) {
    console.error("[Partner Pack Submit] Error:", error)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to submit pack" },
      { status: 500 }
    )
  }
}
