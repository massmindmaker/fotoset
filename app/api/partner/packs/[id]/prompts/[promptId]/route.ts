import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAuthenticatedUser } from "@/lib/auth-middleware"

/**
 * GET /api/partner/packs/[id]/prompts/[promptId]
 * Get single prompt
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; promptId: string } }
) {
  try {
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

    const packId = parseInt(params.id)
    const promptId = parseInt(params.promptId)

    if (isNaN(packId) || isNaN(promptId)) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Invalid pack or prompt ID" },
        { status: 400 }
      )
    }

    // Verify pack ownership and get prompt
    const result = await sql`
      SELECT pp.* FROM pack_prompts pp
      JOIN photo_packs p ON p.id = pp.pack_id
      WHERE pp.id = ${promptId}
        AND pp.pack_id = ${packId}
        AND p.partner_user_id = ${authUser.user.id}
    `

    if (result.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Prompt not found or access denied" },
        { status: 404 }
      )
    }

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
    console.error("[Partner Pack Prompt] GET error:", error)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to fetch prompt" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/partner/packs/[id]/prompts/[promptId]
 * Update prompt
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; promptId: string } }
) {
  try {
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

    const packId = parseInt(params.id)
    const promptId = parseInt(params.promptId)

    if (isNaN(packId) || isNaN(promptId)) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Invalid pack or prompt ID" },
        { status: 400 }
      )
    }

    // Verify pack ownership and get pack status
    const pack = await sql`
      SELECT p.* FROM photo_packs p
      JOIN pack_prompts pp ON pp.pack_id = p.id
      WHERE pp.id = ${promptId}
        AND pp.pack_id = ${packId}
        AND p.partner_user_id = ${authUser.user.id}
    `

    if (pack.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Pack or prompt not found or access denied" },
        { status: 404 }
      )
    }

    // Check if pack can be edited
    const moderationStatus = pack[0].moderation_status
    if (moderationStatus !== "draft" && moderationStatus !== "rejected") {
      return NextResponse.json(
        {
          error: "INVALID_STATE",
          message: "Can only edit prompts in draft or rejected packs",
        },
        { status: 400 }
      )
    }

    const { prompt, negativePrompt, stylePrefix, styleSuffix, previewUrl, position } =
      body

    // Build update query
    const updates: string[] = []
    const values: any[] = []

    if (prompt?.trim()) {
      updates.push(`prompt = $${updates.length + 1}`)
      values.push(prompt.trim())
    }

    if (negativePrompt !== undefined) {
      updates.push(`negative_prompt = $${updates.length + 1}`)
      values.push(negativePrompt?.trim() || null)
    }

    if (stylePrefix !== undefined) {
      updates.push(`style_prefix = $${updates.length + 1}`)
      values.push(stylePrefix?.trim() || null)
    }

    if (styleSuffix !== undefined) {
      updates.push(`style_suffix = $${updates.length + 1}`)
      values.push(styleSuffix?.trim() || null)
    }

    if (previewUrl !== undefined) {
      updates.push(`preview_url = $${updates.length + 1}`)
      values.push(previewUrl?.trim() || null)
    }

    if (position !== undefined && Number.isInteger(position)) {
      updates.push(`position = $${updates.length + 1}`)
      values.push(position)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "No fields to update" },
        { status: 400 }
      )
    }

    values.push(promptId)

    const result = await sql`
      UPDATE pack_prompts
      SET ${sql.unsafe(updates.join(", "))}
      WHERE id = $${values.length}
      RETURNING *
    `

    console.log(
      `[Partner Pack Prompt] Updated prompt #${promptId} in pack #${packId} by user ${authUser.user.id}`
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
      },
    })
  } catch (error) {
    console.error("[Partner Pack Prompt] PUT error:", error)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to update prompt" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/partner/packs/[id]/prompts/[promptId]
 * Remove prompt from pack
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; promptId: string } }
) {
  try {
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

    const packId = parseInt(params.id)
    const promptId = parseInt(params.promptId)

    if (isNaN(packId) || isNaN(promptId)) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Invalid pack or prompt ID" },
        { status: 400 }
      )
    }

    // Verify pack ownership and get pack status
    const pack = await sql`
      SELECT p.* FROM photo_packs p
      JOIN pack_prompts pp ON pp.pack_id = p.id
      WHERE pp.id = ${promptId}
        AND pp.pack_id = ${packId}
        AND p.partner_user_id = ${authUser.user.id}
    `

    if (pack.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Pack or prompt not found or access denied" },
        { status: 404 }
      )
    }

    // Check if pack can be edited
    const moderationStatus = pack[0].moderation_status
    if (moderationStatus !== "draft" && moderationStatus !== "rejected") {
      return NextResponse.json(
        {
          error: "INVALID_STATE",
          message: "Can only edit prompts in draft or rejected packs",
        },
        { status: 400 }
      )
    }

    // Check minimum prompts (must keep at least 1 for future submissions)
    const promptCount = await sql`
      SELECT COUNT(*) as count FROM pack_prompts
      WHERE pack_id = ${packId} AND is_active = TRUE
    `
    if (parseInt(promptCount[0].count) <= 1) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Pack must have at least 1 prompt" },
        { status: 400 }
      )
    }

    // Delete prompt
    await sql`
      DELETE FROM pack_prompts WHERE id = ${promptId}
    `

    console.log(
      `[Partner Pack Prompt] Deleted prompt #${promptId} from pack #${packId} by user ${authUser.user.id}`
    )

    return NextResponse.json({
      success: true,
      message: "Prompt deleted successfully",
    })
  } catch (error) {
    console.error("[Partner Pack Prompt] DELETE error:", error)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to delete prompt" },
      { status: 500 }
    )
  }
}
