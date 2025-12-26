// Cron Job: Check for stuck generation jobs and auto-refund
// Runs every 5 minutes via Vercel Cron or external scheduler
//
// A job is considered "stuck" if:
// - Status is 'processing' AND
// - No progress update in last 10 minutes
//
// Action: Mark as failed + auto-refund payment

import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { autoRefundForFailedGeneration } from "@/lib/tbank"

// Vercel Cron configuration
export const dynamic = "force-dynamic"
export const maxDuration = 60

// How long before a job is considered stuck (in minutes)
const STUCK_THRESHOLD_MINUTES = 10

export async function GET(request: Request) {
  // Verify cron secret (optional but recommended)
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  // If CRON_SECRET is set, require it
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log("[Cron] Unauthorized request - invalid or missing CRON_SECRET")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("[Cron] Starting stuck job check...")

  try {
    // Find stuck jobs:
    // - Status is 'processing'
    // - Last updated more than STUCK_THRESHOLD_MINUTES ago
    const stuckJobs = await sql`
      SELECT
        gj.id as job_id,
        gj.avatar_id,
        gj.status,
        gj.total_photos,
        gj.completed_photos,
        gj.updated_at,
        a.user_id,
        EXTRACT(EPOCH FROM (NOW() - gj.updated_at)) / 60 as minutes_since_update
      FROM generation_jobs gj
      JOIN avatars a ON gj.avatar_id = a.id
      WHERE gj.status = 'processing'
        AND gj.updated_at < NOW() - INTERVAL '10 minutes'
      ORDER BY gj.updated_at ASC
      LIMIT 50
    `

    console.log(`[Cron] Found ${stuckJobs.length} stuck jobs`)

    const results: {
      jobId: number
      avatarId: number
      action: string
      refundSuccess?: boolean
      error?: string
    }[] = []

    for (const job of stuckJobs) {
      console.log(`[Cron] Processing stuck job ${job.job_id}:`, {
        avatarId: job.avatar_id,
        userId: job.user_id,
        progress: `${job.completed_photos}/${job.total_photos}`,
        minutesSinceUpdate: Math.round(job.minutes_since_update),
      })

      try {
        // Mark job as failed
        await sql`
          UPDATE generation_jobs
          SET
            status = 'failed',
            error_message = ${`Job stuck for ${Math.round(job.minutes_since_update)} minutes - auto-refunded`},
            updated_at = NOW()
          WHERE id = ${job.job_id}
        `

        // Reset avatar to draft
        await sql`
          UPDATE avatars
          SET status = 'draft', updated_at = NOW()
          WHERE id = ${job.avatar_id}
        `

        // Trigger auto-refund
        const refundResult = await autoRefundForFailedGeneration(job.avatar_id, job.user_id)

        results.push({
          jobId: job.job_id,
          avatarId: job.avatar_id,
          action: "refunded",
          refundSuccess: refundResult.success,
        })

        console.log(`[Cron] Job ${job.job_id} marked as failed and refund triggered:`, refundResult)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error"
        console.error(`[Cron] Failed to process stuck job ${job.job_id}:`, errorMsg)

        results.push({
          jobId: job.job_id,
          avatarId: job.avatar_id,
          action: "error",
          error: errorMsg,
        })
      }
    }

    // Also check for jobs that have been 'pending' for too long (never started)
    const pendingJobs = await sql`
      SELECT
        gj.id as job_id,
        gj.avatar_id,
        a.user_id,
        EXTRACT(EPOCH FROM (NOW() - gj.created_at)) / 60 as minutes_since_created
      FROM generation_jobs gj
      JOIN avatars a ON gj.avatar_id = a.id
      WHERE gj.status = 'pending'
        AND gj.created_at < NOW() - INTERVAL '15 minutes'
      LIMIT 50
    `

    console.log(`[Cron] Found ${pendingJobs.length} stuck pending jobs`)

    for (const job of pendingJobs) {
      console.log(`[Cron] Processing stuck pending job ${job.job_id}`)

      try {
        await sql`
          UPDATE generation_jobs
          SET
            status = 'failed',
            error_message = 'Job never started - QStash may have failed',
            updated_at = NOW()
          WHERE id = ${job.job_id}
        `

        await sql`
          UPDATE avatars
          SET status = 'draft', updated_at = NOW()
          WHERE id = ${job.avatar_id}
        `

        const refundResult = await autoRefundForFailedGeneration(job.avatar_id, job.user_id)

        results.push({
          jobId: job.job_id,
          avatarId: job.avatar_id,
          action: "refunded_pending",
          refundSuccess: refundResult.success,
        })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error"
        results.push({
          jobId: job.job_id,
          avatarId: job.avatar_id,
          action: "error",
          error: errorMsg,
        })
      }
    }

    return NextResponse.json({
      success: true,
      checked: {
        stuckProcessing: stuckJobs.length,
        stuckPending: pendingJobs.length,
      },
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Cron] Failed to check stuck jobs:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
