import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAuthenticatedUser } from "@/lib/auth-middleware"

/**
 * GET /api/partner/packs/[id]
 * Get pack details with prompts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Get prompts
    const prompts = await sql`
      SELECT * FROM pack_prompts
      WHERE pack_id = ${packId}
      ORDER BY position ASC, id ASC
    `

    return NextResponse.json({
      success: true,
      pack: {
        id: pack[0].id,
        name: pack[0].name,
        slug: pack[0].slug,
        description: pack[0].description,
        iconEmoji: pack[0].icon_emoji,
        previewImages: pack[0].preview_images || [],
        moderationStatus: pack[0].moderation_status,
        isActive: pack[0].is_active,
        isFeatured: pack[0].is_featured,
        sortOrder: pack[0].sort_order,
        usageCount: pack[0].usage_count || 0,
        submittedAt: pack[0].submitted_at,
        reviewedAt: pack[0].reviewed_at,
        rejectionReason: pack[0].rejection_reason,
        createdAt: pack[0].created_at,
        updatedAt: pack[0].updated_at,
      },
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
    console.error("[Partner Pack] GET error:", error)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to fetch pack" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/partner/packs/[id]
 * Update pack (only if draft or rejected)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const { name, description, iconEmoji, previewImages } = body

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []

    if (name?.trim()) {
      updates.push(`name = $${updates.length + 1}`)
      values.push(name.trim())
    }

    if (description !== undefined) {
      updates.push(`description = $${updates.length + 1}`)
      values.push(description?.trim() || null)
    }

    if (iconEmoji !== undefined) {
      updates.push(`icon_emoji = $${updates.length + 1}`)
      values.push(iconEmoji?.trim() || "🎨")
    }

    if (previewImages !== undefined && Array.isArray(previewImages)) {
      updates.push(`preview_images = $${updates.length + 1}`)
      values.push(previewImages)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "No fields to update" },
        { status: 400 }
      )
    }

    // Update pack
    updates.push("updated_at = NOW()")
    values.push(packId)

    const result = await sql`
      UPDATE photo_packs
      SET ${sql.unsafe(updates.join(", "))}
      WHERE id = $${values.length}
      RETURNING *
    `

    console.log(`[Partner Pack] Updated pack #${packId} by user ${authUser.user.id}`)

    return NextResponse.json({
      success: true,
      pack: {
        id: result[0].id,
        name: result[0].name,
        slug: result[0].slug,
        description: result[0].description,
        iconEmoji: result[0].icon_emoji,
        previewImages: result[0].preview_images || [],
        moderationStatus: result[0].moderation_status,
        updatedAt: result[0].updated_at,
      },
    })
  } catch (error) {
    console.error("[Partner Pack] PUT error:", error)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to update pack" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/partner/packs/[id]
 * Delete pack (only if draft)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Check if pack can be deleted
    if (pack[0].moderation_status !== "draft") {
      return NextResponse.json(
        {
          error: "INVALID_STATE",
          message: "Can only delete draft packs",
        },
        { status: 400 }
      )
    }

    // Delete pack (CASCADE will delete prompts)
    await sql`
      DELETE FROM photo_packs WHERE id = ${packId}
    `

    console.log(`[Partner Pack] Deleted pack #${packId} by user ${authUser.user.id}`)

    return NextResponse.json({
      success: true,
      message: "Pack deleted successfully",
    })
  } catch (error) {
    console.error("[Partner Pack] DELETE error:", error)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to delete pack" },
      { status: 500 }
    )
  }
}
