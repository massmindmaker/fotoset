// Cron Job: Clean up orphaned storage and stale data
// Runs daily to:
// 1. Delete orphaned generated_photos (avatar deleted)
// 2. Clean up old qstash_processed_messages (>7 days)
// 3. Clean up old webhook_logs (>30 days)

import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { deleteImages, isR2Configured, getAvatarIdFromKey } from "@/lib/r2"

// Vercel Cron configuration
export const dynamic = "force-dynamic"
export const maxDuration = 60

// Retention periods
const QSTASH_RETENTION_DAYS = 7
const WEBHOOK_LOG_RETENTION_DAYS = 30
const ORPHAN_CHECK_DAYS = 7 // Only clean up photos from avatars deleted >7 days ago

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[Cron/Storage] CRON_SECRET not configured")
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.log("[Cron/Storage] Unauthorized request")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("[Cron/Storage] Starting storage cleanup...")

  const results = {
    orphanedPhotosDeleted: 0,
    r2FilesDeleted: 0,
    qstashMessagesDeleted: 0,
    webhookLogsDeleted: 0,
    errors: [] as string[],
  }

  try {
    // 1. Find orphaned photos (generated_photos without valid avatar)
    // Only process if avatar was deleted more than ORPHAN_CHECK_DAYS ago
    const orphanedPhotos = await sql`
      SELECT gp.id, gp.image_url
      FROM generated_photos gp
      LEFT JOIN avatars a ON gp.avatar_id = a.id
      WHERE a.id IS NULL
      LIMIT 100
    `

    if (orphanedPhotos.length > 0) {
      console.log(`[Cron/Storage] Found ${orphanedPhotos.length} orphaned photos`)

      // Extract R2 keys from URLs and delete
      const r2Keys: string[] = []
      for (const photo of orphanedPhotos) {
        if (photo.image_url && photo.image_url.includes('r2.cloudflarestorage.com')) {
          // Extract key from R2 URL
          try {
            const url = new URL(photo.image_url)
            const key = url.pathname.slice(1) // Remove leading slash
            if (key) r2Keys.push(key)
          } catch (e) {
            // Ignore invalid URLs
          }
        }
      }

      // Delete from R2 if configured
      if (isR2Configured() && r2Keys.length > 0) {
        try {
          await deleteImages(r2Keys)
          results.r2FilesDeleted = r2Keys.length
          console.log(`[Cron/Storage] Deleted ${r2Keys.length} files from R2`)
        } catch (r2Error) {
          const errMsg = r2Error instanceof Error ? r2Error.message : 'Unknown R2 error'
          results.errors.push(`R2 delete failed: ${errMsg}`)
          console.error("[Cron/Storage] R2 delete error:", r2Error)
        }
      }

      // Delete orphaned records from database
      const photoIds = orphanedPhotos.map((p: any) => p.id)
      await sql`
        DELETE FROM generated_photos
        WHERE id = ANY(${photoIds})
      `
      results.orphanedPhotosDeleted = orphanedPhotos.length
    }

    // 2. Clean up old qstash_processed_messages (>7 days)
    try {
      const qstashResult = await sql`
        DELETE FROM qstash_processed_messages
        WHERE processed_at < NOW() - INTERVAL '7 days'
      `
      results.qstashMessagesDeleted = qstashResult.length
      if (qstashResult.length > 0) {
        console.log(`[Cron/Storage] Deleted ${qstashResult.length} old qstash messages`)
      }
    } catch (e) {
      // Table might not exist
      console.log("[Cron/Storage] qstash cleanup skipped (table may not exist)")
    }

    // 3. Clean up old webhook_logs (>30 days)
    try {
      const webhookResult = await sql`
        DELETE FROM webhook_logs
        WHERE created_at < NOW() - INTERVAL '30 days'
      `
      results.webhookLogsDeleted = webhookResult.length
      if (webhookResult.length > 0) {
        console.log(`[Cron/Storage] Deleted ${webhookResult.length} old webhook logs`)
      }
    } catch (e) {
      // Table might not exist
      console.log("[Cron/Storage] webhook_logs cleanup skipped")
    }

    console.log("[Cron/Storage] Cleanup complete:", results)

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error("[Cron/Storage] Cleanup failed:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        ...results,
      },
      { status: 500 }
    )
  }
}
