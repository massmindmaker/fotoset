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
    console.error('[Partner Pack Prompts] Session check error:', e)
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
 * GET /api/partner/packs/[id]/prompts
 * List prompts in pack
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    if (isNaN(packId)) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Invalid pack ID" },
        { status: 400 }
      )
    }

    // Verify pack ownership
    const pack = await sql`
      SELECT id FROM photo_packs
      WHERE id = ${packId} AND partner_user_id = ${userId}
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
    if (isNaN(packId)) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Invalid pack ID" },
        { status: 400 }
      )
    }

    // Get pack and verify ownership
    const pack = await sql`
      SELECT * FROM photo_packs
      WHERE id = ${packId} AND partner_user_id = ${userId}
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

    // Get next position if not provided
    let nextPosition = position ?? 0
    if (nextPosition === 0) {
      const maxPosition = await sql`
        SELECT COALESCE(MAX(position), -1) as max_position
        FROM pack_prompts WHERE pack_id = ${packId}
      `
      nextPosition = parseInt(maxPosition[0].max_position) + 1
    }

    // ATOMIC: Check limit and insert in single transaction (prevents race condition)
    const result = await sql`
      WITH prompt_check AS (
        SELECT COUNT(*) as count FROM pack_prompts
        WHERE pack_id = ${packId} AND is_active = TRUE
      )
      INSERT INTO pack_prompts (
        pack_id,
        prompt,
        negative_prompt,
        style_prefix,
        style_suffix,
        preview_url,
        position,
        is_active
      )
      SELECT
        ${packId},
        ${prompt.trim()},
        ${negativePrompt?.trim() || null},
        ${stylePrefix?.trim() || null},
        ${styleSuffix?.trim() || null},
        ${previewUrl?.trim() || null},
        ${nextPosition},
        TRUE
      FROM prompt_check
      WHERE prompt_check.count < 23
      RETURNING *
    `

    // Check if insert succeeded (will be empty if limit exceeded)
    if (result.length === 0) {
      return NextResponse.json(
        { error: "LIMIT_EXCEEDED", message: "Maximum 23 prompts per pack" },
        { status: 400 }
      )
    }

    console.log(
      `[Partner Pack Prompts] Added prompt #${result[0].id} to pack #${packId} by user ${userId}`
    )

    // Copy external preview image to R2 for permanent storage
    let finalPreviewUrl = result[0].preview_url
    if (isExternalPreviewUrl(result[0].preview_url) && isR2Configured()) {
      try {
        const key = generatePreviewKey(packId, result[0].id)
        console.log(`[Partner Pack Prompts] Copying external preview to R2: ${key}`)
        
        const uploadResult = await uploadFromUrl(result[0].preview_url, key)
        
        // Update the prompt with permanent R2 URL
        await sql`
          UPDATE pack_prompts 
          SET preview_url = ${uploadResult.url}
          WHERE id = ${result[0].id}
        `
        
        finalPreviewUrl = uploadResult.url
        console.log(`[Partner Pack Prompts] Preview copied to R2: ${uploadResult.url}`)
      } catch (uploadError) {
        // Non-critical error - keep original URL, log warning
        console.error("[Partner Pack Prompts] Failed to copy preview to R2:", uploadError)
        console.warn("[Partner Pack Prompts] Keeping original external URL - may not display in WebApp")
      }
    }

    // Update pack preview images if the prompt has a preview
    if (finalPreviewUrl) {
      try {
        await updatePackPreviewImages(packId)
        console.log(`[Partner Pack Prompts] Updated preview images for pack #${packId}`)
      } catch (previewError) {
        // Non-critical error, log but don't fail the request
        console.error("[Partner Pack Prompts] Failed to update preview images:", previewError)
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
