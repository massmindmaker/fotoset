// Cron Job: Poll pending preview generation tasks
// Runs every 10 seconds to check Kie.ai task status and update saved prompts
// Similar to poll-kie-tasks but for admin preview generation

export const maxDuration = 55 // Keep under Vercel's 60s cron limit

import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { checkKieTaskStatus } from "@/lib/kie"
import { uploadFromUrl, getPublicUrl, isR2Configured } from "@/lib/r2"

function getSql() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }
  return neon(connectionString)
}

// Vercel cron requires GET
export async function GET() {
  const startTime = Date.now()
  console.log("[Poll Preview Tasks] Starting...")

  try {
    const sql = getSql()

    // Get pending preview tasks (limit to avoid timeout)
    const pendingTasks = await sql`
      SELECT pt.*, sp.name as prompt_name
      FROM preview_tasks pt
      JOIN saved_prompts sp ON sp.id = pt.prompt_id
      WHERE pt.status = 'pending'
      ORDER BY pt.created_at ASC
      LIMIT 10
    `

    if (pendingTasks.length === 0) {
      console.log("[Poll Preview Tasks] No pending tasks")
      return NextResponse.json({ success: true, processed: 0 })
    }

    console.log(`[Poll Preview Tasks] Found ${pendingTasks.length} pending tasks`)

    const useR2 = isR2Configured()
    let completed = 0
    let failed = 0
    let stillPending = 0

    for (const task of pendingTasks) {
      // Check if we're running out of time (leave 10s buffer)
      if (Date.now() - startTime > 45000) {
        console.log("[Poll Preview Tasks] Approaching timeout, stopping")
        break
      }

      console.log(`[Poll Preview Tasks] Checking task ${task.kie_task_id} for prompt "${task.prompt_name}"`)

      try {
        const result = await checkKieTaskStatus(task.kie_task_id)

        if (result.status === "completed" && result.url) {
          // Upload to R2 if configured
          let finalImageUrl = result.url
          if (useR2) {
            try {
              const r2Key = `previews/prompt-${task.prompt_id}-${Date.now()}.jpg`
              await uploadFromUrl(result.url, r2Key)
              finalImageUrl = getPublicUrl(r2Key)
              console.log(`[Poll Preview Tasks] Uploaded to R2: ${r2Key}`)
            } catch (r2Error) {
              console.warn(`[Poll Preview Tasks] R2 upload failed, using original URL:`, r2Error)
            }
          }

          // Update saved_prompt with preview_url
          await sql`
            UPDATE saved_prompts
            SET preview_url = ${finalImageUrl}
            WHERE id = ${task.prompt_id}
          `

          // Mark task as completed
          await sql`
            UPDATE preview_tasks
            SET status = 'completed', completed_at = NOW()
            WHERE id = ${task.id}
          `

          console.log(`[Poll Preview Tasks] ✓ Task ${task.kie_task_id} completed for prompt "${task.prompt_name}"`)
          completed++

        } else if (result.status === "failed") {
          await sql`
            UPDATE preview_tasks
            SET status = 'failed', error_message = ${result.error || 'Unknown error'}
            WHERE id = ${task.id}
          `
          console.log(`[Poll Preview Tasks] ✗ Task ${task.kie_task_id} failed: ${result.error}`)
          failed++

        } else {
          // Still pending/processing
          // Check if task has been pending too long (5 minutes = 30 checks at 10s interval)
          const taskAge = Date.now() - new Date(task.created_at).getTime()
          const maxAge = 5 * 60 * 1000 // 5 minutes

          if (taskAge > maxAge) {
            await sql`
              UPDATE preview_tasks
              SET status = 'failed', error_message = 'Timeout after 5 minutes'
              WHERE id = ${task.id}
            `
            console.log(`[Poll Preview Tasks] ✗ Task ${task.kie_task_id} timed out`)
            failed++
          } else {
            stillPending++
          }
        }
      } catch (checkError) {
        console.error(`[Poll Preview Tasks] Error checking task ${task.kie_task_id}:`, checkError)
        stillPending++
      }
    }

    const elapsed = Date.now() - startTime
    console.log(`[Poll Preview Tasks] Done in ${elapsed}ms: ${completed} completed, ${failed} failed, ${stillPending} pending`)

    return NextResponse.json({
      success: true,
      processed: pendingTasks.length,
      completed,
      failed,
      stillPending,
      elapsedMs: elapsed,
    })

  } catch (error) {
    console.error("[Poll Preview Tasks] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
