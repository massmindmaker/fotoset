// Background Job Processor - Called by Upstash QStash
// ASYNC ARCHITECTURE: Creates Kie.ai tasks and returns immediately
// Polling is done by /api/cron/poll-kie-tasks
export const maxDuration = 60 // Now fast - just creates tasks (~5s each)

import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createKieTask, type KieGenerationOptions } from "@/lib/kie"
import { PHOTOSET_PROMPTS } from "@/lib/prompts"
import {
  verifyQStashSignature,
  publishGenerationJob,
  type GenerationJobPayload,
  GENERATION_CONFIG,
} from "@/lib/qstash"

// POST /api/jobs/process - Create Kie.ai tasks for a generation chunk
export async function POST(request: Request) {
  // Verify QStash signature
  const { valid, body } = await verifyQStashSignature(request)

  if (!valid) {
    console.error("[Jobs/Process] Invalid QStash signature")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: GenerationJobPayload
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { jobId, avatarId, telegramUserId, styleId, photoCount, referenceImages, startIndex, chunkSize, prompts } = payload

  console.log("[Jobs/Process] Processing chunk:", {
    jobId,
    avatarId,
    startIndex,
    chunkSize,
    totalPhotos: photoCount,
  })

  try {
    // For first chunk, use atomic lock to prevent dual execution
    if (startIndex === 0) {
      const lockResult = await sql`
        UPDATE generation_jobs
        SET status = 'processing', updated_at = NOW()
        WHERE id = ${jobId} AND status = 'pending'
        RETURNING id
      `

      if (lockResult.length === 0) {
        const job = await sql`
          SELECT status FROM generation_jobs WHERE id = ${jobId}
        `.then((rows: any[]) => rows[0])

        if (!job) {
          console.error("[Jobs/Process] Job not found:", jobId)
          return NextResponse.json({ error: "Job not found" }, { status: 404 })
        }

        if (job.status === "completed" || job.status === "failed") {
          console.log("[Jobs/Process] Job already finished:", job.status)
          return NextResponse.json({ success: true, skipped: true })
        }

        if (job.status === "processing") {
          console.log("[Jobs/Process] Job already being processed, skipping")
          return NextResponse.json({ success: true, skipped: true, reason: "already_processing" })
        }
      }
    } else {
      // Verify job exists and is still processing
      const job = await sql`
        SELECT id, status FROM generation_jobs WHERE id = ${jobId}
      `.then((rows: any[]) => rows[0])

      if (!job) {
        console.error("[Jobs/Process] Job not found:", jobId)
        return NextResponse.json({ error: "Job not found" }, { status: 404 })
      }

      if (job.status === "completed" || job.status === "failed") {
        console.log("[Jobs/Process] Job already finished:", job.status)
        return NextResponse.json({ success: true, skipped: true })
      }
    }

    // Get prompts for this chunk (use explicit prompts if provided, fallback to PHOTOSET_PROMPTS)
    const endIndex = Math.min(startIndex + chunkSize, photoCount)
    const promptsToProcess = prompts
      ? prompts.slice(startIndex, endIndex)
      : PHOTOSET_PROMPTS.slice(startIndex, endIndex)

    console.log(`[Jobs/Process] Creating ${promptsToProcess.length} Kie.ai tasks (${startIndex} to ${endIndex - 1})`)

    const tasksCreated: { promptIndex: number; taskId: string }[] = []
    const tasksFailed: { promptIndex: number; error: string }[] = []

    // Create Kie.ai tasks (fire-and-forget, ~2-5s each)
    for (let i = 0; i < promptsToProcess.length; i++) {
      const prompt = promptsToProcess[i]
      const promptIndex = startIndex + i

      // Check if task already exists (prevent duplicates from retries)
      const existing = await sql`
        SELECT id FROM kie_tasks
        WHERE job_id = ${jobId} AND prompt_index = ${promptIndex}
        LIMIT 1
      `.then((rows: any[]) => rows[0])

      if (existing) {
        console.log(`[Jobs/Process] Task for prompt ${promptIndex} already exists, skipping`)
        continue
      }

      const options: KieGenerationOptions = {
        prompt,
        referenceImages: referenceImages.slice(0, 4),
        aspectRatio: "3:4",
      }

      console.log(`[Jobs/Process] Creating Kie.ai task for prompt ${promptIndex + 1}/${photoCount}`)
      const result = await createKieTask(options)

      if (result.success && result.taskId) {
        // Save task to database for polling
        await sql`
          INSERT INTO kie_tasks (job_id, avatar_id, kie_task_id, prompt_index, prompt, status)
          VALUES (${jobId}, ${avatarId}, ${result.taskId}, ${promptIndex}, ${prompt.substring(0, 500)}, 'pending')
        `
        tasksCreated.push({ promptIndex, taskId: result.taskId })
        console.log(`[Jobs/Process] ✓ Created task ${result.taskId} for prompt ${promptIndex + 1}`)
      } else {
        tasksFailed.push({ promptIndex, error: result.error || "Unknown error" })
        console.error(`[Jobs/Process] ✗ Failed to create task for prompt ${promptIndex + 1}: ${result.error}`)

        // Save failed task for tracking
        await sql`
          INSERT INTO kie_tasks (job_id, avatar_id, kie_task_id, prompt_index, prompt, status, error_message)
          VALUES (${jobId}, ${avatarId}, ${'failed-' + Date.now()}, ${promptIndex}, ${prompt.substring(0, 500)}, 'failed', ${result.error})
        `
      }
    }

    // Queue next chunk if needed
    const nextStartIndex = endIndex
    if (nextStartIndex < photoCount) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

      await publishGenerationJob(
        {
          jobId,
          avatarId,
          telegramUserId,
          styleId,
          photoCount,
          referenceImages,
          startIndex: nextStartIndex,
          chunkSize: GENERATION_CONFIG.CHUNK_SIZE,
          prompts, // Pass explicit prompts to next chunk
        },
        baseUrl
      )

      console.log(`[Jobs/Process] Queued next chunk starting at ${nextStartIndex}`)
    }

    return NextResponse.json({
      success: true,
      jobId,
      processedChunk: { startIndex, endIndex },
      tasksCreated: tasksCreated.length,
      tasksFailed: tasksFailed.length,
      message: `Created ${tasksCreated.length} Kie.ai tasks, ${tasksFailed.length} failed. Polling will complete them.`,
    })

  } catch (error) {
    console.error("[Jobs/Process] Critical error:", error)

    const errorMessage = error instanceof Error ? error.message : "Processing failed"
    await sql`
      UPDATE generation_jobs
      SET error_message = ${errorMessage}, updated_at = NOW()
      WHERE id = ${jobId}
    `.catch(() => {})

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
