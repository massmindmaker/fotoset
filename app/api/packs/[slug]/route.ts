/**
 * GET /api/packs/[slug] - Get pack details by slug
 *
 * Returns pack information for StyleDetailView component
 * @see components/views/style-detail-view.tsx
 */

import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { error, createLogger } from "@/lib/api-utils"

const logger = createLogger("PackDetail")

interface RouteContext {
  params: Promise<{ slug: string }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { slug } = await context.params

    if (!slug) {
      return error("VALIDATION_ERROR", "Pack slug is required")
    }

    logger.info("Fetching pack detail", { slug })

    const packRows = await sql`
      SELECT
        p.id,
        p.slug,
        p.name,
        p.description,
        p.icon_emoji AS "emoji",
        p.cover_url AS "coverUrl",
        p.is_active AS "isActive",
        p.usage_count AS "usageCount",
        p.preview_images AS "previewImages",
        COALESCE(
          (SELECT COUNT(*) FROM pack_prompts WHERE pack_id = p.id AND is_active = TRUE),
          0
        ) AS "itemsCount"
      FROM photo_packs p
      WHERE p.slug = ${slug}
        AND p.is_active = TRUE
        AND p.moderation_status = 'approved'
      LIMIT 1
    `

    const pack = packRows[0]

    if (!pack) {
      return error("NOT_FOUND", "Pack not found", null, 404)
    }

    logger.info("Pack found", { slug, id: pack.id })

    // StyleDetailView expects a direct object, NOT wrapped in success()
    // It does: const data = await response.json(); setPack(data)
    return Response.json({
      id: pack.id,
      slug: pack.slug,
      name: pack.name,
      description: pack.description,
      emoji: pack.emoji,
      coverUrl: pack.coverUrl,
      isActive: pack.isActive,
      itemsCount: parseInt(pack.itemsCount, 10),
      usageCount: pack.usageCount || 0,
      previewImages: pack.previewImages || [],
    })
  } catch (err) {
    logger.error("Failed to fetch pack detail", { error: String(err) })
    return error("DATABASE_ERROR", "Failed to fetch pack details")
  }
}
