// Cron Job: Clean up expired admin sessions
// Runs every hour to remove expired sessions from the database
// Prevents database bloat from accumulating stale session records

import { NextResponse } from "next/server"
import { cleanupExpiredSessions } from "@/lib/admin/session"
import { cleanupOldAttempts } from "@/lib/admin/rate-limit"

// Vercel Cron configuration
export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  // CRON_SECRET is required for security
  if (!cronSecret) {
    console.error("[Cron/Cleanup] CRON_SECRET not configured - rejecting request")
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.log("[Cron/Cleanup] Unauthorized request - invalid CRON_SECRET")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("[Cron/Cleanup] Starting expired sessions cleanup...")

  try {
    const deletedSessions = await cleanupExpiredSessions()
    const deletedAttempts = await cleanupOldAttempts()

    console.log(`[Cron/Cleanup] Deleted ${deletedSessions} expired sessions, ${deletedAttempts} old login attempts`)

    return NextResponse.json({
      success: true,
      deletedSessions,
      deletedLoginAttempts: deletedAttempts,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Cron/Cleanup] Failed to cleanup sessions:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
