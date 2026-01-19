import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { success, error, createLogger } from "@/lib/api-utils"

const logger = createLogger("Packs")

// ============================================================================
// Types
// ============================================================================

interface PackListItem {
  id: number
  slug: string
  name: string
  description: string | null
  iconEmoji: string
  previewImages: string[]
  promptCount: number
  usageCount: number
  isFeatured: boolean
  sortOrder: number
  ownerType: "admin" | "partner"
  partnerUsername?: string
}

// ============================================================================
// GET /api/packs - List all active, approved photo packs
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    logger.info("Fetching active approved packs")

    // Query all active and approved packs with prompt count
    const packs = await sql`
      SELECT
        p.id,
        p.slug,
        p.name,
        p.description,
        p.icon_emoji AS "iconEmoji",
        p.preview_images AS "previewImages",
        p.usage_count AS "usageCount",
        p.is_featured AS "isFeatured",
        p.sort_order AS "sortOrder",
        p.owner_type AS "ownerType",
        u.telegram_username AS "partnerUsername",
        COALESCE(
          (SELECT COUNT(*) FROM pack_prompts WHERE pack_id = p.id AND is_active = TRUE),
          0
        ) AS "promptCount"
      FROM photo_packs p
      LEFT JOIN users u ON p.partner_user_id = u.id
      WHERE p.is_active = TRUE AND p.moderation_status = 'approved'
      ORDER BY p.sort_order ASC, p.is_featured DESC, p.id ASC
    `

    const packList: PackListItem[] = packs.map((pack: any) => ({
      id: pack.id,
      slug: pack.slug,
      name: pack.name,
      description: pack.description,
      iconEmoji: pack.iconEmoji,
      previewImages: pack.previewImages || [],
      promptCount: parseInt(pack.promptCount, 10),
      usageCount: pack.usageCount,
      isFeatured: pack.isFeatured,
      sortOrder: pack.sortOrder,
      ownerType: pack.ownerType,
      ...(pack.ownerType === "partner" && pack.partnerUsername
        ? { partnerUsername: pack.partnerUsername }
        : {}),
    }))

    logger.info(`Found ${packList.length} active packs`)

    return success({ packs: packList })
  } catch (err) {
    logger.error("Failed to fetch packs", { error: String(err) })
    return error("DATABASE_ERROR", "Failed to fetch photo packs")
  }
}
