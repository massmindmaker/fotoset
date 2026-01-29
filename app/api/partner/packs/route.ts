import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getCurrentPartnerSession } from "@/lib/partner/session"
import { extractIdentifierFromRequest, findUserByIdentifier } from "@/lib/user-identity"

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
    console.error('[Partner Packs] Session check error:', e)
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
 * GET /api/partner/packs
 * List partner's own packs (all statuses)
 */
export async function GET(request: NextRequest) {
  try {
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

    // Get partner's packs with prompt counts
    const packs = await sql`
      SELECT
        p.id,
        p.name,
        p.slug,
        p.description,
        p.icon_emoji,
        p.preview_images,
        p.moderation_status,
        p.is_active,
        p.is_featured,
        p.sort_order,
        p.usage_count,
        p.submitted_at,
        p.reviewed_at,
        p.rejection_reason,
        p.created_at,
        p.updated_at,
        COUNT(pp.id) as prompt_count
      FROM photo_packs p
      LEFT JOIN pack_prompts pp ON pp.pack_id = p.id AND pp.is_active = TRUE
      WHERE p.partner_user_id = ${userId}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `

    return NextResponse.json({
      success: true,
      packs: packs.map((pack: any) => ({
        id: pack.id,
        name: pack.name,
        slug: pack.slug,
        description: pack.description,
        iconEmoji: pack.icon_emoji,
        previewImages: pack.preview_images || [],
        moderationStatus: pack.moderation_status,
        isActive: pack.is_active,
        isFeatured: pack.is_featured,
        sortOrder: pack.sort_order,
        usageCount: pack.usage_count || 0,
        promptCount: parseInt(pack.prompt_count) || 0,
        submittedAt: pack.submitted_at,
        reviewedAt: pack.reviewed_at,
        rejectionReason: pack.rejection_reason,
        createdAt: pack.created_at,
        updatedAt: pack.updated_at,
      })),
    })
  } catch (error) {
    console.error("[Partner Packs] GET error:", error)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to fetch packs" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/partner/packs
 * Create new pack (status: draft)
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()

    // Validate required fields
    const { name, description, iconEmoji, previewImages } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Pack name is required" },
        { status: 400 }
      )
    }

    // Check pack limit (max 5 per partner)
    const packCount = await sql`
      SELECT COUNT(*) as count FROM photo_packs
      WHERE partner_user_id = ${userId}
    `
    if (parseInt(packCount[0].count) >= 5) {
      return NextResponse.json(
        { error: "LIMIT_EXCEEDED", message: "Maximum 5 packs per partner" },
        { status: 400 }
      )
    }

    // Generate slug from name
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 100)

    // Ensure unique slug
    let slug = baseSlug
    let counter = 1
    while (true) {
      const existingSlug = await sql`
        SELECT id FROM photo_packs WHERE slug = ${slug}
      `
      if (existingSlug.length === 0) break
      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Create pack
    const result = await sql`
      INSERT INTO photo_packs (
        name,
        slug,
        description,
        icon_emoji,
        preview_images,
        owner_type,
        partner_user_id,
        moderation_status,
        is_active
      ) VALUES (
        ${name.trim()},
        ${slug},
        ${description?.trim() || null},
        ${iconEmoji?.trim() || '🎨'},
        ${previewImages && Array.isArray(previewImages) ? previewImages : []},
        'partner',
        ${userId},
        'draft',
        FALSE
      )
      RETURNING *
    `

    console.log(`[Partner Packs] Created pack #${result[0].id} by user ${userId}`)

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
        isActive: result[0].is_active,
        createdAt: result[0].created_at,
      },
    })
  } catch (error) {
    console.error("[Partner Packs] POST error:", error)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to create pack" },
      { status: 500 }
    )
  }
}
