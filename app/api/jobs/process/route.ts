// Background Job Processor - Called by Upstash QStash
// IMPORTANT: maxDuration is required for long-running AI generation
// Vercel Pro allows up to 300s, each Kie.ai call can take up to 95s
export const maxDuration = 300 // Maximum for Vercel Pro

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
import { autoRefundForFailedGeneration } from "@/lib/tbank"

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

  // Debug: Log environment variables for Kie.ai
  const kieAiKey = process.env.KIE_AI_API_KEY?.trim()
  const kieKey = process.env.KIE_API_KEY?.trim()
  const replicateKey = process.env.REPLICATE_API_TOKEN?.trim()
  console.log("[Jobs/Process] ENV CHECK:", {
    KIE_AI_API_KEY_length: kieAiKey?.length || 0,
    KIE_AI_API_KEY_first5: kieAiKey?.substring(0, 5) || "NOT_SET",
    KIE_API_KEY_length: kieKey?.length || 0,
    REPLICATE_length: replicateKey?.length || 0,
  })

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

    // Process photos in PARALLEL within chunk (Kie.ai supports concurrent requests)
    const PARALLEL_LIMIT = 2 // Generate 2 photos at a time (Kie.ai stable)
    const useR2 = isR2Configured()

    console.log(`[Jobs/Process] Processing ${promptsToProcess.length} photos in parallel (limit: ${PARALLEL_LIMIT})`)

    // Process in batches of PARALLEL_LIMIT
    for (let batchStart = 0; batchStart < promptsToProcess.length; batchStart += PARALLEL_LIMIT) {
      const batchEnd = Math.min(batchStart + PARALLEL_LIMIT, promptsToProcess.length)
      const batchPrompts = promptsToProcess.slice(batchStart, batchEnd)

      console.log(`[Jobs/Process] Parallel batch ${batchStart}-${batchEnd - 1}`)

      const batchResults = await Promise.allSettled(
        batchPrompts.map(async (prompt, batchIndex) => {
          const promptIndex = startIndex + batchStart + batchIndex

          const options: GenerationOptions = {
            prompt,
            referenceImages: referenceImages.slice(0, 4),
            aspectRatio: "3:4",
            resolution: "1K",
          }

          console.log(`[Jobs/Process] Starting photo ${promptIndex + 1}`)
          const imageUrl = await generateImage(options)

          // Upload to R2 if configured
          let finalImageUrl = imageUrl
          if (useR2) {
            try {
              const r2Key = generatePromptKey(avatarId.toString(), styleId, promptIndex, "png")
              const r2Result = await uploadFromUrl(imageUrl, r2Key)
              finalImageUrl = r2Result.url
            } catch (r2Error) {
              console.warn(`[Jobs/Process] R2 upload failed for ${promptIndex}:`, r2Error)
            }
          }

          // Save to database (with duplicate check)
          // Use prompt_index to prevent duplicates from QStash retries
          const existingPhoto = await sql`
            SELECT id FROM generated_photos
            WHERE avatar_id = ${avatarId} AND style_id = ${styleId} AND prompt = ${prompt.substring(0, 500)}
            LIMIT 1
          `.then((rows: any[]) => rows[0])

          if (!existingPhoto) {
            await sql`
              INSERT INTO generated_photos (avatar_id, style_id, prompt, image_url)
              VALUES (${avatarId}, ${styleId}, ${prompt.substring(0, 500)}, ${finalImageUrl})
            `
          } else {
            console.log(`[Jobs/Process] Photo ${promptIndex + 1} already exists, skipping duplicate`)
          }

          return { promptIndex, imageUrl: finalImageUrl }
        })
      )

      // Process batch results
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i]
        const promptIndex = startIndex + batchStart + i

        if (result.status === "fulfilled") {
          results.push({ success: true, url: result.value.imageUrl, index: promptIndex })
          console.log(`[Jobs/Process] ✓ Photo ${promptIndex + 1}/${photoCount}`)

          // Update progress based on actual photo count (prevents inflation from retries)
          const actualCount = await sql`
            SELECT COUNT(*) as count FROM generated_photos
            WHERE avatar_id = ${avatarId} AND style_id = ${styleId}
          `.then((rows: any[]) => parseInt(rows[0]?.count || '0'))

          await sql`
            UPDATE generation_jobs
            SET completed_photos = ${actualCount}, updated_at = NOW()
            WHERE id = ${jobId}
          `.catch(() => {})
        } else {
          const errorMsg = result.reason instanceof Error ? result.reason.message : "Unknown error"
          results.push({ success: false, error: errorMsg, index: promptIndex })
          console.error(`[Jobs/Process] ✗ Photo ${promptIndex + 1}:`, errorMsg)

          await sql`
            UPDATE generation_jobs
            SET error_message = ${errorMsg}, updated_at = NOW()
            WHERE id = ${jobId}
          `.catch(() => {})
        }
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
      // All chunks processed - check final result
      const finalJob = await sql`
        SELECT completed_photos, total_photos FROM generation_jobs WHERE id = ${jobId}
      `.then((rows: any[]) => rows[0])

      const failedPhotos = finalJob.total_photos - finalJob.completed_photos

      // POLICY: If ANY photo failed, refund the entire payment
      if (failedPhotos > 0) {
        console.log(`[Jobs/Process] ${failedPhotos}/${finalJob.total_photos} photos failed - triggering auto-refund`)

        // Get userId from avatar
        const avatarData = await sql`
          SELECT user_id FROM avatars WHERE id = ${avatarId}
        `.then((rows: any[]) => rows[0])

        if (avatarData?.user_id) {
          const refundResult = await autoRefundForFailedGeneration(avatarId, avatarData.user_id)
          console.log(`[Jobs/Process] Auto-refund result:`, refundResult)
        }

        // Mark as failed
        await sql`
          UPDATE generation_jobs
          SET status = 'failed',
              error_message = ${`${failedPhotos}/${finalJob.total_photos} photos failed - payment refunded`},
              updated_at = NOW()
          WHERE id = ${jobId}
        `

        await sql`
          UPDATE avatars
          SET status = 'draft', updated_at = NOW()
          WHERE id = ${avatarId}
        `

        console.log(`[Jobs/Process] Job ${jobId} failed - ${failedPhotos} photos failed, payment refunded`)
      } else {
        // All photos successful
        await sql`
          UPDATE generation_jobs
          SET status = 'completed', updated_at = NOW()
          WHERE id = ${jobId}
        `

        await sql`
          UPDATE avatars
          SET status = 'ready', updated_at = NOW()
          WHERE id = ${avatarId}
        `

        console.log(`[Jobs/Process] Job ${jobId} completed successfully - all ${finalJob.total_photos} photos generated`)
      }
    }

    return NextResponse.json({
      success: true,
      jobId,
      processedChunk: { startIndex, endIndex },
      results: results.map((r) => ({ index: r.index, success: r.success })),
    })
  } catch (error) {
    console.error("[Jobs/Process] Critical error:", error)

    // Get userId for refund
    try {
      const avatarData = await sql`
        SELECT user_id FROM avatars WHERE id = ${avatarId}
      `.then((rows: any[]) => rows[0])

      if (avatarData?.user_id) {
        console.log(`[Jobs/Process] Fatal error - triggering auto-refund for avatar ${avatarId}`)
        const refundResult = await autoRefundForFailedGeneration(avatarId, avatarData.user_id)
        console.log(`[Jobs/Process] Auto-refund result:`, refundResult)
      }
    } catch (refundError) {
      console.error("[Jobs/Process] Auto-refund failed:", refundError)
    }

    // Mark job as failed
    const errorMessage = error instanceof Error ? error.message : "Processing failed"
    await sql`
      UPDATE generation_jobs
      SET status = 'failed', error_message = ${`${errorMessage} - payment refunded`}, updated_at = NOW()
      WHERE id = ${jobId}
    `.catch(() => {})

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
