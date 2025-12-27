// Debug endpoint to test async generation
// Creates a Kie.ai task directly and saves to kie_tasks table

export const maxDuration = 60

import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createKieTask } from "@/lib/kie"
import { PHOTOSET_PROMPTS } from "@/lib/prompts"

export async function GET() {
  const startTime = Date.now()

  try {
    // Get reference images from avatar 9
    const refs = await sql`
      SELECT image_url FROM reference_photos WHERE avatar_id = 9 LIMIT 4
    `
    const referenceImages = refs.map((r: { image_url: string }) => r.image_url)

    if (referenceImages.length === 0) {
      return NextResponse.json({ error: "No reference images found for avatar 9" })
    }

    // Create a test job
    const jobResult = await sql`
      INSERT INTO generation_jobs (avatar_id, style_id, status, total_photos)
      VALUES (9, 'test-async-debug', 'processing', 1)
      RETURNING id
    `
    const jobId = jobResult[0].id

    console.log(`[Test Async] Created job ${jobId}`)

    // Create Kie.ai task (fire-and-forget)
    const prompt = PHOTOSET_PROMPTS[0] // First prompt
    const result = await createKieTask({
      prompt,
      referenceImages: referenceImages.slice(0, 4),
      aspectRatio: "3:4",
    })

    const createTime = Date.now() - startTime

    if (!result.success || !result.taskId) {
      return NextResponse.json({
        success: false,
        error: result.error,
        createTimeMs: createTime,
        jobId,
      })
    }

    // Save task to kie_tasks
    await sql`
      INSERT INTO kie_tasks (job_id, avatar_id, kie_task_id, prompt_index, prompt, status)
      VALUES (${jobId}, 9, ${result.taskId}, 0, ${prompt.substring(0, 500)}, 'pending')
    `

    console.log(`[Test Async] Task ${result.taskId} created in ${createTime}ms`)

    return NextResponse.json({
      success: true,
      jobId,
      taskId: result.taskId,
      createTimeMs: createTime,
      message: "Task created! Call /api/cron/poll-kie-tasks or wait for cron to complete it.",
      checkUrl: `/api/debug/check-task?jobId=${jobId}`,
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      elapsedMs: Date.now() - startTime,
    })
  }
}
