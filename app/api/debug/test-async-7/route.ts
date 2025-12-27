// Debug endpoint to test async generation with 7 photos (Starter tier)

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

    // Create a test job for 7 photos
    const jobResult = await sql`
      INSERT INTO generation_jobs (avatar_id, style_id, status, total_photos)
      VALUES (9, 'test-async-7', 'processing', 7)
      RETURNING id
    `
    const jobId = jobResult[0].id

    console.log(`[Test Async 7] Created job ${jobId}`)

    // Create 7 Kie.ai tasks (like CHUNK_SIZE=7)
    const tasksCreated: string[] = []
    const tasksFailed: string[] = []

    for (let i = 0; i < 7; i++) {
      const prompt = PHOTOSET_PROMPTS[i]
      const result = await createKieTask({
        prompt,
        referenceImages: referenceImages.slice(0, 4),
        aspectRatio: "3:4",
      })

      if (result.success && result.taskId) {
        await sql`
          INSERT INTO kie_tasks (job_id, avatar_id, kie_task_id, prompt_index, prompt, status)
          VALUES (${jobId}, 9, ${result.taskId}, ${i}, ${prompt.substring(0, 500)}, 'pending')
        `
        tasksCreated.push(result.taskId)
        console.log(`[Test Async 7] Task ${i + 1}/7 created: ${result.taskId}`)
      } else {
        tasksFailed.push(result.error || "Unknown error")
        console.error(`[Test Async 7] Task ${i + 1}/7 failed: ${result.error}`)
      }
    }

    const createTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      jobId,
      tasksCreated: tasksCreated.length,
      tasksFailed: tasksFailed.length,
      createTimeMs: createTime,
      message: `Created ${tasksCreated.length}/7 tasks. Cron will complete them in ~3-5 minutes.`,
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
