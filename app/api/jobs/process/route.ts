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
import { uploadFromUrl, generatePromptKey, isR2Configured } from "@/lib/r2"

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

  const { jobId, avatarId, telegramUserId, styleId, photoCount, referenceImages, startIndex, chunkSize } = payload

  console.log("[Jobs/Process] Processing chunk:", {
    jobId,
    avatarId,
    startIndex,
    chunkSize,
    totalPhotos: photoCount,
  })

  try {
    // For first chunk, use atomic lock to prevent dual execution with local after()
    if (startIndex === 0) {
      const lockResult = await sql`
        UPDATE generation_jobs
        SET status = 'processing', updated_at = NOW()
        WHERE id = ${jobId} AND status = 'pending'
        RETURNING id
      `

      if (lockResult.length === 0) {
        // Check if already processing (which is fine) or finished
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

        // If status is 'processing', another executor started first - skip this one
        if (job.status === "processing") {
          console.log("[Jobs/Process] Job already being processed by another executor, skipping")
          return NextResponse.json({ success: true, skipped: true, reason: "already_processing" })
        }
      }
    } else {
      // For subsequent chunks, just verify job exists and is still processing
      const job = await sql`
        SELECT id, status, completed_photos, total_photos
        FROM generation_jobs
        WHERE id = ${jobId}
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

        console.log(`[Jobs/Process] Calling generateImage for photo ${promptIndex + 1}, KIE_AI_API_KEY length: ${(process.env.KIE_AI_API_KEY || process.env.KIE_API_KEY)?.trim()?.length || 0}`)
        const imageUrl = await generateImage(options)

        // Upload to R2 if configured, fallback to original URL
        let finalImageUrl = imageUrl
        const useR2 = isR2Configured()
        if (useR2) {
          try {
            const r2Key = generatePromptKey(avatarId.toString(), styleId, promptIndex, "png")
            const r2Result = await uploadFromUrl(imageUrl, r2Key)
            finalImageUrl = r2Result.url
            console.log(`[Jobs/Process] Uploaded to R2: ${r2Key}`)
          } catch (r2Error) {
            console.warn(`[Jobs/Process] R2 upload failed, using original URL:`, r2Error)
            // Keep original URL as fallback
          }
        }

        // Save to database
        await sql`
          INSERT INTO generated_photos (avatar_id, style_id, prompt, image_url)
          VALUES (${avatarId}, ${styleId}, ${prompt.substring(0, 500)}, ${finalImageUrl})
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
          telegramUserId,
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
      `.then((rows: any[]) => rows[0])

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
