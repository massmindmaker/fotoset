import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAuthenticatedUser } from "@/lib/auth-middleware"

/**
 * GET /api/partner/packs/[id]/prompts
 * List prompts in pack
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const authUser = await getAuthenticatedUser(request)

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

    // Verify pack ownership
    const pack = await sql`
      SELECT id FROM photo_packs
      WHERE id = ${packId} AND partner_user_id = ${authUser.user.id}
    `

    if (pack.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Pack not found or access denied" },
        { status: 404 }
      )
    }

    // Get prompts
    const prompts = await sql`
      SELECT * FROM pack_prompts
      WHERE pack_id = ${packId}
      ORDER BY position ASC, id ASC
    `

    return NextResponse.json({
      success: true,
      prompts: prompts.map((p: any) => ({
        id: p.id,
        prompt: p.prompt,
        negativePrompt: p.negative_prompt,
        stylePrefix: p.style_prefix,
        styleSuffix: p.style_suffix,
        previewUrl: p.preview_url,
        position: p.position,
        isActive: p.is_active,
        createdAt: p.created_at,
      })),
    })
  } catch (error) {
    console.error("[Partner Pack Prompts] GET error:", error)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to fetch prompts" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/partner/packs/[id]/prompts
 * Add prompt to pack
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

    // Check if pack can be edited
    const moderationStatus = pack[0].moderation_status
    if (moderationStatus !== "draft" && moderationStatus !== "rejected") {
      return NextResponse.json(
        {
          error: "INVALID_STATE",
          message: "Can only edit draft or rejected packs",
        },
        { status: 400 }
      )
    }

    // Validate required fields
    const { prompt, negativePrompt, stylePrefix, styleSuffix, previewUrl, position } =
      body

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Prompt is required" },
        { status: 400 }
      )
    }

    // Check prompt limit (max 23)
    const promptCount = await sql`
      SELECT COUNT(*) as count FROM pack_prompts
      WHERE pack_id = ${packId} AND is_active = TRUE
    `
    if (parseInt(promptCount[0].count) >= 23) {
      return NextResponse.json(
        { error: "LIMIT_EXCEEDED", message: "Maximum 23 prompts per pack" },
        { status: 400 }
      )
    }

    // Get next position if not provided
    let nextPosition = position ?? 0
    if (nextPosition === 0) {
      const maxPosition = await sql`
        SELECT COALESCE(MAX(position), -1) as max_position
        FROM pack_prompts WHERE pack_id = ${packId}
      `
      nextPosition = parseInt(maxPosition[0].max_position) + 1
    }

    // Add prompt
    const result = await sql`
      INSERT INTO pack_prompts (
        pack_id,
        prompt,
        negative_prompt,
        style_prefix,
        style_suffix,
        preview_url,
        position,
        is_active
      ) VALUES (
        ${packId},
        ${prompt.trim()},
        ${negativePrompt?.trim() || null},
        ${stylePrefix?.trim() || null},
        ${styleSuffix?.trim() || null},
        ${previewUrl?.trim() || null},
        ${nextPosition},
        TRUE
      )
      RETURNING *
    `

    console.log(
      `[Partner Pack Prompts] Added prompt #${result[0].id} to pack #${packId} by user ${authUser.user.id}`
    )

    return NextResponse.json({
      success: true,
      prompt: {
        id: result[0].id,
        prompt: result[0].prompt,
        negativePrompt: result[0].negative_prompt,
        stylePrefix: result[0].style_prefix,
        styleSuffix: result[0].style_suffix,
        previewUrl: result[0].preview_url,
        position: result[0].position,
        isActive: result[0].is_active,
        createdAt: result[0].created_at,
      },
    })
  } catch (error) {
    console.error("[Partner Pack Prompts] POST error:", error)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to add prompt" },
      { status: 500 }
    )
  }
}
