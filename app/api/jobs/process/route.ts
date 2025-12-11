// Background Job Processor - Called by Upstash QStash
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { generateImage, type GenerationOptions } from "@/lib/imagen"
import { PHOTOSET_PROMPTS } from "@/lib/prompts"
import {
  verifyQStashSignature,
  publishGenerationJob,
  type GenerationJobPayload,
  GENERATION_CONFIG,
} from "@/lib/qstash"

// POST /api/jobs/process - Process a generation chunk
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

  const { jobId, avatarId, deviceId, styleId, photoCount, referenceImages, startIndex, chunkSize } = payload

  console.log("[Jobs/Process] Processing chunk:", {
    jobId,
    avatarId,
    startIndex,
    chunkSize,
    totalPhotos: photoCount,
  })

  try {
    // Verify job exists and is still processing
    const job = await sql`
      SELECT id, status, completed_photos, total_photos
      FROM generation_jobs
      WHERE id = ${jobId}
    `.then((rows) => rows[0])

    if (!job) {
      console.error("[Jobs/Process] Job not found:", jobId)
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    if (job.status === "completed" || job.status === "failed") {
      console.log("[Jobs/Process] Job already finished:", job.status)
      return NextResponse.json({ success: true, skipped: true })
    }

    // Get prompts for this chunk
    const endIndex = Math.min(startIndex + chunkSize, photoCount)
    const promptsToProcess = PHOTOSET_PROMPTS.slice(startIndex, endIndex)

    console.log(`[Jobs/Process] Processing prompts ${startIndex} to ${endIndex - 1}`)

    const results: { success: boolean; url?: string; error?: string; index: number }[] = []

    // Process each photo in the chunk
    for (let i = 0; i < promptsToProcess.length; i++) {
      const promptIndex = startIndex + i
      const prompt = promptsToProcess[i]

      try {
        const options: GenerationOptions = {
          prompt,
          referenceImages: referenceImages.slice(0, 4), // Use up to 4 reference images
          aspectRatio: "3:4",
          resolution: "1K",
        }

        const imageUrl = await generateImage(options)

        // Save to database
        await sql`
          INSERT INTO generated_photos (avatar_id, style_id, prompt, image_url)
          VALUES (${avatarId}, ${styleId}, ${prompt.substring(0, 500)}, ${imageUrl})
        `

        // Update job progress
        await sql`
          UPDATE generation_jobs
          SET completed_photos = completed_photos + 1, updated_at = NOW()
          WHERE id = ${jobId}
        `

        results.push({ success: true, url: imageUrl, index: promptIndex })
        console.log(`[Jobs/Process] ✓ Generated photo ${promptIndex + 1}/${photoCount}`)

        // Small delay between generations to avoid rate limits
        if (i < promptsToProcess.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error"
        console.error(`[Jobs/Process] ✗ Failed photo ${promptIndex + 1}:`, errorMsg)
        results.push({ success: false, error: errorMsg, index: promptIndex })

        // Update job with error but continue
        await sql`
          UPDATE generation_jobs
          SET error_message = ${errorMsg}, updated_at = NOW()
          WHERE id = ${jobId}
        `
      }
    }

    // Check if there are more chunks to process
    const nextStartIndex = endIndex
    if (nextStartIndex < photoCount) {
      // Queue next chunk
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

      await publishGenerationJob(
        {
          jobId,
          avatarId,
          deviceId,
          styleId,
          photoCount,
          referenceImages,
          startIndex: nextStartIndex,
          chunkSize: GENERATION_CONFIG.CHUNK_SIZE,
        },
        baseUrl
      )

      console.log(`[Jobs/Process] Queued next chunk starting at ${nextStartIndex}`)
    } else {
      // All chunks processed - mark job as completed
      const finalJob = await sql`
        SELECT completed_photos, total_photos FROM generation_jobs WHERE id = ${jobId}
      `.then((rows) => rows[0])

      const finalStatus = finalJob.completed_photos >= finalJob.total_photos * 0.5 ? "completed" : "failed"

      await sql`
        UPDATE generation_jobs
        SET status = ${finalStatus}, updated_at = NOW()
        WHERE id = ${jobId}
      `

      // Update avatar status
      await sql`
        UPDATE avatars
        SET status = ${finalStatus === "completed" ? "ready" : "draft"}, updated_at = NOW()
        WHERE id = ${avatarId}
      `

      console.log(`[Jobs/Process] Job ${jobId} finished with status: ${finalStatus}`)
    }

    return NextResponse.json({
      success: true,
      jobId,
      processedChunk: { startIndex, endIndex },
      results: results.map((r) => ({ index: r.index, success: r.success })),
    })
  } catch (error) {
    console.error("[Jobs/Process] Critical error:", error)

    // Mark job as failed
    await sql`
      UPDATE generation_jobs
      SET status = 'failed', error_message = ${error instanceof Error ? error.message : "Processing failed"}, updated_at = NOW()
      WHERE id = ${jobId}
    `.catch(() => {})

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    )
  }
}
