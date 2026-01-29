import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getCurrentPartnerSession } from "@/lib/partner/session"
import { extractIdentifierFromRequest, findUserByIdentifier } from "@/lib/user-identity"
import { updatePackPreviewImages } from "@/lib/pack-helpers"
import { uploadFromUrl, isR2Configured } from "@/lib/r2"

/**
 * Check if URL is external (not already in R2)
 * Returns true if the image should be copied to R2
 */
function isExternalPreviewUrl(url: string | null | undefined): boolean {
  if (!url) return false
  // R2 URLs - already in our storage
  if (url.includes('.r2.dev')) return false
  if (url.includes('r2.cloudflarestorage.com')) return false
  // Our specific R2 public bucket
  if (url.includes('pub-8c1af6d8a8944be49e5e168a1b0f03c8')) return false
  // External URL that should be copied
  return url.startsWith('http')
}

/**
 * Generate R2 key for pack prompt preview
 * Format: previews/pack-{packId}/prompt-{promptId}-{timestamp}.jpg
 */
function generatePreviewKey(packId: number, promptId: number): string {
  const timestamp = Date.now()
  return `previews/pack-${packId}/prompt-${promptId}-${timestamp}.jpg`
}

/**
 * Helper to get authenticated partner user ID
 * Checks: 1) partner_session cookie, 2) query params (telegram/neon)
 */
async function getPartnerUserId(request: NextRequest): Promise<number | null> {
  // Priority 1: Partner session cookie
  try {
    const sessionPromise = getCurrentPartnerSession()
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
    const session = await Promise.race([sessionPromise, timeoutPromise])
    if (session?.userId) {
      return session.userId
    }
  } catch (e) {
    console.error('[Partner Pack Prompt] Session check error:', e)
  }

  // Priority 2: Query params (Telegram/Neon auth)
  const { searchParams } = new URL(request.url)
  const telegramUserId = searchParams.get('telegram_user_id')
  const neonUserId = searchParams.get('neon_auth_id') || searchParams.get('neon_user_id')

  if (telegramUserId || neonUserId) {
    const identifier = extractIdentifierFromRequest({
      telegram_user_id: telegramUserId,
      neon_auth_id: neonUserId
    })
    const basicUser = await findUserByIdentifier(identifier)
    if (basicUser) {
      return basicUser.id
    }
  }

  return null
}

/**
 * GET /api/partner/packs/[id]/prompts/[promptId]
 * Get single prompt
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; promptId: string }> }
) {
  try {
    const { id, promptId: promptIdParam } = await params
    const userId = await getPartnerUserId(request)

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      )
    }

    // Check if user is partner
    const partnerCheck = await sql`
      SELECT is_partner FROM referral_balances WHERE user_id = ${userId}
    `
    if (partnerCheck.length === 0 || !partnerCheck[0].is_partner) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Partner status required" },
        { status: 403 }
      )
    }

    const packId = parseInt(id)
    const promptId = parseInt(promptIdParam)

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
        AND p.partner_user_id = ${userId}
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
  { params }: { params: Promise<{ id: string; promptId: string }> }
) {
  try {
    const { id, promptId: promptIdParam } = await params
    const body = await request.json()
    const userId = await getPartnerUserId(request)

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      )
    }

    // Check if user is partner
    const partnerCheck = await sql`
      SELECT is_partner FROM referral_balances WHERE user_id = ${userId}
    `
    if (partnerCheck.length === 0 || !partnerCheck[0].is_partner) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Partner status required" },
        { status: 403 }
      )
    }

    const packId = parseInt(id)
    const promptId = parseInt(promptIdParam)

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
        AND p.partner_user_id = ${userId}
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
      `[Partner Pack Prompt] Updated prompt #${promptId} in pack #${packId} by user ${userId}`
    )

    // Copy external preview image to R2 if previewUrl was changed to external URL
    let finalPreviewUrl = result[0].preview_url
    if (previewUrl !== undefined && isExternalPreviewUrl(result[0].preview_url) && isR2Configured()) {
      try {
        const key = generatePreviewKey(packId, promptId)
        console.log(`[Partner Pack Prompt] Copying external preview to R2: ${key}`)
        
        const uploadResult = await uploadFromUrl(result[0].preview_url, key)
        
        // Update the prompt with permanent R2 URL
        await sql`
          UPDATE pack_prompts 
          SET preview_url = ${uploadResult.url}
          WHERE id = ${promptId}
        `
        
        finalPreviewUrl = uploadResult.url
        console.log(`[Partner Pack Prompt] Preview copied to R2: ${uploadResult.url}`)
      } catch (uploadError) {
        // Non-critical error - keep original URL, log warning
        console.error("[Partner Pack Prompt] Failed to copy preview to R2:", uploadError)
        console.warn("[Partner Pack Prompt] Keeping original external URL - may not display in WebApp")
      }
    }

    // Update pack preview images if previewUrl was changed
    if (previewUrl !== undefined) {
      try {
        await updatePackPreviewImages(packId)
        console.log(`[Partner Pack Prompt] Updated preview images for pack #${packId}`)
      } catch (previewError) {
        // Non-critical error, log but don't fail the request
        console.error("[Partner Pack Prompt] Failed to update preview images:", previewError)
      }
    }

    return NextResponse.json({
      success: true,
      prompt: {
        id: result[0].id,
        prompt: result[0].prompt,
        negativePrompt: result[0].negative_prompt,
        stylePrefix: result[0].style_prefix,
        styleSuffix: result[0].style_suffix,
        previewUrl: finalPreviewUrl,
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
  { params }: { params: Promise<{ id: string; promptId: string }> }
) {
  try {
    const { id, promptId: promptIdParam } = await params
    const userId = await getPartnerUserId(request)

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      )
    }

    // Check if user is partner
    const partnerCheck = await sql`
      SELECT is_partner FROM referral_balances WHERE user_id = ${userId}
    `
    if (partnerCheck.length === 0 || !partnerCheck[0].is_partner) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Partner status required" },
        { status: 403 }
      )
    }

    const packId = parseInt(id)
    const promptId = parseInt(promptIdParam)

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
        AND p.partner_user_id = ${userId}
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
      `[Partner Pack Prompt] Deleted prompt #${promptId} from pack #${packId} by user ${userId}`
    )

    // Update pack preview images after deletion
    try {
      await updatePackPreviewImages(packId)
      console.log(`[Partner Pack Prompt] Updated preview images for pack #${packId} after deletion`)
    } catch (previewError) {
      // Non-critical error, log but don't fail the request
      console.error("[Partner Pack Prompt] Failed to update preview images:", previewError)
    }

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
