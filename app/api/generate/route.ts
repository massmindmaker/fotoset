import { type NextRequest, after } from "next/server"
import { sql } from "@/lib/db"
import { generateMultipleImages, type GenerationResult } from "@/lib/imagen"
import { PHOTOSET_PROMPTS, STYLE_CONFIGS } from "@/lib/prompts"
import {
  filterAndSortReferenceImages,
  smartMergePrompt,
  enhancePromptForConsistency,
} from "@/lib/image-utils"
import { sendGenerationNotification } from "@/lib/telegram-notify"
import {
  success,
  error,
  validateRequired,
  createLogger,
} from "@/lib/api-utils"
import {
  HAS_QSTASH,
  publishGenerationJob,
  GENERATION_CONFIG as QSTASH_CONFIG,
} from "@/lib/qstash"
import { uploadFromUrl, generatePromptKey, isR2Configured } from "@/lib/r2"
import { findOrCreateUser } from "@/lib/user-identity"
import {
  getUserIdentifier,
  verifyResourceOwnershipWithIdentifier,
} from "@/lib/auth-utils"

const logger = createLogger("Generate")

// ============================================================================
// Configuration
// ============================================================================

const GENERATION_CONFIG = {
  concurrency: 7,              // Parallel requests (increased for speed)
  maxPhotos: 23,               // Max photos per generation
  maxReferenceImages: 20,      // Use all user images (10-20)
  minReferenceImages: 1,       // Minimum for generation
  maxRetries: 2,               // Max retries for failed generations
}

// NOTE: Rate limiting removed (2025-12-20)
// In-memory rate limiting doesn't work on Vercel serverless
// Protection: Telegram auth + payment barrier + Google API quotas

// ============================================================================
// Background Generation
// ============================================================================

/**
 * Background generation function - runs after response is sent
 * Saves each photo to DB immediately for progressive loading
 */
async function runBackgroundGeneration(params: {
  jobId: number
  dbAvatarId: number
  userId: number
  styleId: string
  mergedPrompts: string[]
  validReferenceImages: string[]
  totalPhotos: number
  startTime: number
  concurrency: number
}) {
  const {
    jobId,
    dbAvatarId,
    userId,
    styleId,
    mergedPrompts,
    validReferenceImages,
    totalPhotos,
    startTime,
    concurrency,
  } = params

  let successCount = 0
  let failedCount = 0
  let firstPhotoUrl: string | null = null

  try {
    // RACE CONDITION FIX: Atomic lock to prevent dual execution
    // Only proceed if we can atomically update status from 'pending' to 'processing'
    const lockResult = await sql`
      UPDATE generation_jobs
      SET status = 'processing', updated_at = NOW()
      WHERE id = ${jobId} AND status = 'pending'
      RETURNING id
    `

    if (lockResult.length === 0) {
      // Job already being processed or completed - skip to prevent duplicate execution
      logger.warn("Job already locked/processing, skipping duplicate execution", { jobId })
      return
    }

    logger.info("Starting background generation", {
      jobId,
      avatarId: dbAvatarId,
      totalPhotos,
      concurrency,
    })

    const results: GenerationResult[] = await generateMultipleImages(
      mergedPrompts,
      validReferenceImages,
      {
        concurrency,
        maxRetries: GENERATION_CONFIG.maxRetries,
        onProgress: async (completed, total) => {
          // Update progress in DB every 3 photos or at completion
          if (completed % 3 === 0 || completed === total) {
            await sql`
              UPDATE generation_jobs
              SET completed_photos = ${completed}, updated_at = NOW()
              WHERE id = ${jobId}
            `.catch(err => logger.error("Progress update failed", { jobId, error: err.message }))
          }
        },
      }
    )

    // Save each successful photo to DB immediately
    const useR2 = isR2Configured()
    if (useR2) {
      logger.info("R2 storage enabled, will upload generated images", { jobId })
    }

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.success && result.url) {
        successCount++
        const originalPrompt = mergedPrompts[i]

        // Upload to R2 if configured, fallback to original URL
        let finalImageUrl = result.url
        if (useR2) {
          try {
            const r2Key = generatePromptKey(dbAvatarId.toString(), styleId, i, "png")
            const r2Result = await uploadFromUrl(result.url, r2Key)
            finalImageUrl = r2Result.url
            logger.debug("Uploaded to R2", { jobId, photoIndex: i, r2Key })
          } catch (r2Error) {
            logger.warn("R2 upload failed, using original URL", {
              jobId,
              photoIndex: i,
              error: r2Error instanceof Error ? r2Error.message : "Unknown",
            })
            // Keep original URL as fallback
          }
        }

        // Save photo to DB
        await sql`
          INSERT INTO generated_photos (avatar_id, style_id, prompt, image_url)
          VALUES (${dbAvatarId}, ${styleId}, ${originalPrompt}, ${finalImageUrl})
        `.catch(err => logger.error("Failed to save photo to DB", { jobId, photoIndex: i, error: err.message }))

        // Set first photo as thumbnail
        if (!firstPhotoUrl) {
          firstPhotoUrl = finalImageUrl
          await sql`
            UPDATE avatars
            SET thumbnail_url = ${finalImageUrl}, updated_at = NOW()
            WHERE id = ${dbAvatarId}
          `.catch(err => logger.error("Failed to update thumbnail", { avatarId: dbAvatarId, error: err.message }))
        }
      } else {
        failedCount++
        logger.warn("Photo generation failed", {
          jobId,
          photoIndex: i,
          error: result.error,
        })
      }
    }

    // Update job status to completed
    const finalStatus = successCount > 0 ? "completed" : "failed"
    await sql`
      UPDATE generation_jobs
      SET status = ${finalStatus},
          completed_photos = ${successCount},
          error_message = ${failedCount > 0 ? `${failedCount} photos failed to generate` : null},
          updated_at = NOW()
      WHERE id = ${jobId}
    `

    // Update avatar status
    if (successCount > 0) {
      await sql`
        UPDATE avatars
        SET status = 'ready', updated_at = NOW()
        WHERE id = ${dbAvatarId}
      `
    }

    // Send Telegram notification if user is connected
    try {
      const userWithTelegram = await sql`
        SELECT telegram_user_id FROM users WHERE id = ${userId}
      `.then(rows => rows[0])

      if (userWithTelegram?.telegram_user_id && successCount > 0 && firstPhotoUrl) {
        await sendGenerationNotification(
          userWithTelegram.telegram_user_id,
          successCount,
          firstPhotoUrl,
          dbAvatarId
        )
        logger.info("Telegram notification sent", {
          telegramUserId: userWithTelegram.telegram_user_id,
          successCount,
        })
      }
    } catch (notifyError) {
      logger.error("Telegram notification failed", {
        error: notifyError instanceof Error ? notifyError.message : "Unknown",
      })
    }

    const elapsedTime = Math.round((Date.now() - startTime) / 1000)
    logger.info("Generation completed", {
      jobId,
      avatarId: dbAvatarId,
      successCount,
      failedCount,
      totalPhotos,
      elapsedSeconds: elapsedTime,
    })

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    logger.error("Generation fatal error", { jobId, error: errorMessage })

    // Update job status to failed
    await sql`
      UPDATE generation_jobs
      SET status = 'failed',
          error_message = ${errorMessage},
          updated_at = NOW()
      WHERE id = ${jobId}
    `.catch(e => logger.error("Failed to update job status", { jobId, error: e.message }))

    // Reset avatar status
    await sql`
      UPDATE avatars
      SET status = 'draft', updated_at = NOW()
      WHERE id = ${dbAvatarId}
    `.catch(() => {})
  }
}

// ============================================================================
// POST /api/generate - Start photo generation
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()

    // Validate required fields (referenceImages optional if useStoredReferences=true)
    const { telegramUserId, avatarId, styleId, referenceImages, photoCount, useStoredReferences } = body

    // Require Telegram user ID (no deviceId fallback)
    if (!telegramUserId) {
      return error("UNAUTHORIZED", "telegramUserId is required")
    }

    // NaN validation for telegramUserId
    const tgId = typeof telegramUserId === 'number' ? telegramUserId : parseInt(String(telegramUserId))
    if (isNaN(tgId)) {
      return error("VALIDATION_ERROR", "Invalid telegramUserId format")
    }

    const requiredFields = useStoredReferences
      ? ["avatarId", "styleId"]
      : ["avatarId", "styleId", "referenceImages"]

    const validation = validateRequired(body, requiredFields)
    if (!validation.valid) {
      const missingFields = (validation as { valid: false; missing: string[] }).missing
      logger.warn("Validation failed", { missing: missingFields })
      return error("VALIDATION_ERROR", `Missing required fields: ${missingFields.join(", ")}`)
    }

    // Get reference images - either from request or from stored DB records
    let referenceImagesList: string[] = []

    if (useStoredReferences) {
      // Fetch stored reference photos from database
      logger.info("Using stored reference images", { avatarId })

      // Verify the avatar belongs to this user (telegram_user_id only)
      const avatarCheck = await sql`
        SELECT a.id FROM avatars a
        JOIN users u ON a.user_id = u.id
        WHERE u.telegram_user_id = ${tgId} AND a.id = ${parseInt(avatarId)}
      `.then(rows => rows[0])

      if (!avatarCheck) {
        return error("AVATAR_NOT_FOUND", "Avatar not found or access denied")
      }

      const storedRefs = await sql`
        SELECT image_url FROM reference_photos
        WHERE avatar_id = ${parseInt(avatarId)}
        ORDER BY created_at ASC
      `

      if (storedRefs.length === 0) {
        return error("NO_REFERENCE_IMAGES", "No stored reference images found. Please upload photos first.")
      }

      referenceImagesList = storedRefs.map((r: { image_url: string }) => r.image_url)
      logger.info("Loaded stored references", { count: referenceImagesList.length })
    } else {
      // Use provided reference images
      if (!Array.isArray(referenceImages) || referenceImages.length === 0) {
        return error("NO_REFERENCE_IMAGES", "At least one reference image is required")
      }
      referenceImagesList = referenceImages
    }

    // Validate style
    const styleConfig = STYLE_CONFIGS[styleId as keyof typeof STYLE_CONFIGS]
    if (!styleConfig) {
      return error("INVALID_STYLE", `Invalid style: ${styleId}. Available: ${Object.keys(STYLE_CONFIGS).join(", ")}`)
    }

    logger.info("Generation request received", {
      telegramUserId: tgId,
      avatarId,
      styleId,
      referenceCount: referenceImagesList.length,
      useStoredReferences: !!useStoredReferences,
      requestedPhotos: photoCount,
    })

    // Find or create user with telegram_user_id only
    const user = await findOrCreateUser({ telegramUserId: tgId })
    logger.info("User resolved", { userId: user.id, telegramUserId: tgId })

    // ============================================================================
    // Payment Validation
    // ============================================================================

    // Check if user has a successful payment
    const successfulPayment = await sql`
      SELECT id, amount, status FROM payments
      WHERE user_id = ${user.id} AND status = 'succeeded'
      ORDER BY created_at DESC
      LIMIT 1
    `.then((rows) => rows[0])

    if (!successfulPayment) {
      logger.warn("User has no successful payment", { userId: user.id, telegramUserId: tgId })
      return error("PAYMENT_REQUIRED", "Please complete payment before generating photos", {
        code: "PAYMENT_REQUIRED"
      })
    }

    logger.info("Payment validated", {
      userId: user.id,
      paymentId: successfulPayment.id,
      amount: successfulPayment.amount
    })

    // Handle avatar - if timestamp string from frontend, create new in DB
    let dbAvatarId: number

    // PostgreSQL INTEGER max = 2,147,483,647
    // Frontend generates ID as Date.now() (~1.7 trillion), which overflows INTEGER
    const parsedAvatarId = parseInt(avatarId)
    const isValidDbId = !isNaN(parsedAvatarId) && parsedAvatarId > 0 && parsedAvatarId <= 2147483647

    let existingAvatar = null
    if (isValidDbId) {
      existingAvatar = await sql`
        SELECT id FROM avatars WHERE id = ${parsedAvatarId} AND user_id = ${user.id}
      `.then((rows) => rows[0])
    }

    if (existingAvatar) {
      dbAvatarId = existingAvatar.id
      logger.info("Using existing avatar", { avatarId: dbAvatarId })
    } else {
      const newAvatar = await sql`
        INSERT INTO avatars (user_id, name, status)
        VALUES (${user.id}, 'My Avatar', 'processing')
        RETURNING id
      `.then((rows) => rows[0])
      dbAvatarId = newAvatar.id
      logger.info("Created new avatar", {
        avatarId: dbAvatarId,
        frontendId: avatarId,
        wasValidDbId: isValidDbId,
      })
    }

    // Validate and filter reference images
    logger.info("Validating reference images", { count: referenceImagesList.length })
    const { selected: validReferenceImages, rejected } = filterAndSortReferenceImages(
      referenceImagesList,
      GENERATION_CONFIG.maxReferenceImages
    )

    if (rejected.length > 0) {
      logger.warn("Some images rejected", { rejectedCount: rejected.length, reasons: rejected })
    }

    if (validReferenceImages.length < GENERATION_CONFIG.minReferenceImages) {
      return error("NO_REFERENCE_IMAGES", "No valid reference images. Please upload clear photos.", {
        rejectedImages: rejected,
      })
    }

    logger.info("Reference images validated", { validCount: validReferenceImages.length })

    // Save reference images to DB for reuse (skip if using stored references)
    let savedCount = 0
    if (!useStoredReferences) {
      logger.info("Saving reference images to DB", { count: validReferenceImages.length })
      try {
        const insertPromises = validReferenceImages.map(imageUrl =>
          sql`INSERT INTO reference_photos (avatar_id, image_url) VALUES (${dbAvatarId}, ${imageUrl})`
        )
        const results = await Promise.allSettled(insertPromises)
        savedCount = results.filter(r => r.status === 'fulfilled').length
        const failedCount = results.filter(r => r.status === 'rejected').length
        if (failedCount > 0) {
          logger.warn("Some reference photos failed to save", { savedCount, failedCount })
        }
      } catch (err) {
        logger.error("Failed to save reference photos", {
          error: err instanceof Error ? err.message : "Unknown",
        })
      }
      logger.info("Reference images saved", { savedCount, avatarId: dbAvatarId })
    } else {
      logger.info("Skipping reference save - using stored images")
    }

    // Create generation job
    const requestedPhotos = photoCount && photoCount > 0 ? photoCount : GENERATION_CONFIG.maxPhotos
    const totalPhotos = Math.min(requestedPhotos, PHOTOSET_PROMPTS.length, GENERATION_CONFIG.maxPhotos)

    const job = await sql`
      INSERT INTO generation_jobs (avatar_id, style_id, status, total_photos)
      VALUES (${dbAvatarId}, ${styleId}, 'pending', ${totalPhotos})
      RETURNING *
    `.then((rows) => rows[0])

    logger.info("Generation job created", {
      jobId: job.id,
      avatarId: dbAvatarId,
      styleId,
      requestedPhotos,
      totalPhotos,
    })

    // Prepare prompts with style
    const basePrompts = PHOTOSET_PROMPTS.slice(0, totalPhotos)
    const mergedPrompts = basePrompts.map(basePrompt =>
      smartMergePrompt({
        basePrompt,
        stylePrefix: styleConfig.promptPrefix,
        styleSuffix: styleConfig.promptSuffix,
      })
    ).map(prompt =>
      enhancePromptForConsistency(prompt)
    )

    logger.info("Prompts prepared", { count: mergedPrompts.length })

    // Choose processing method: QStash (background) or local (blocking)
    if (HAS_QSTASH) {
      // Use QStash for reliable background processing (survives Vercel timeout)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "http://localhost:3000"

      logger.info("Using QStash for background generation", { baseUrl })

      const qstashResult = await publishGenerationJob(
        {
          jobId: job.id,
          avatarId: dbAvatarId,
          telegramUserId: tgId,
          styleId,
          photoCount: totalPhotos,
          referenceImages: validReferenceImages,
          startIndex: 0,
          chunkSize: QSTASH_CONFIG.CHUNK_SIZE,
        },
        baseUrl
      )

      if (!qstashResult) {
        logger.error("Failed to publish to QStash, falling back to local")
        // Fall back to local generation
        after(() => {
          runBackgroundGeneration({
            jobId: job.id,
            dbAvatarId,
            userId: user.id,
            styleId,
            mergedPrompts,
            validReferenceImages,
            totalPhotos,
            startTime,
            concurrency: GENERATION_CONFIG.concurrency,
          })
        })
      } else {
        logger.info("Job published to QStash", { messageId: qstashResult.messageId })
      }
    } else {
      // Local generation (may timeout on Vercel)
      logger.info("Using local background generation (QStash not configured)")
      after(() => {
        runBackgroundGeneration({
          jobId: job.id,
          dbAvatarId,
          userId: user.id,
          styleId,
          mergedPrompts,
          validReferenceImages,
          totalPhotos,
          startTime,
          concurrency: GENERATION_CONFIG.concurrency,
        })
      })
    }

    // Return immediately with job info for polling
    return success({
      jobId: job.id,
      avatarId: dbAvatarId,
      status: "processing",
      totalPhotos,
      referenceImagesUsed: validReferenceImages.length,
      referenceImagesRejected: rejected.length,
      style: styleConfig.name,
      processingMode: HAS_QSTASH ? "qstash" : "local",
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    logger.error("Generation request failed", { error: errorMessage })

    return error("GENERATION_FAILED", "Generation failed to start", {
      message: errorMessage,
    })
  }
}

// ============================================================================
// GET /api/generate - Check generation status
// ============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const jobId = searchParams.get("job_id")
  const avatarId = searchParams.get("avatar_id")

  if (!jobId && !avatarId) {
    return error("VALIDATION_ERROR", "Either job_id or avatar_id is required")
  }

  // SECURITY: Get user identifier for ownership verification
  const identifier = getUserIdentifier(request)

  if (!identifier.telegramUserId) {
    return error("UNAUTHORIZED", "Authentication required")
  }

  try {
    let job

    if (jobId) {
      const parsedJobId = parseInt(jobId, 10)
      if (isNaN(parsedJobId)) {
        return error("VALIDATION_ERROR", "Invalid job_id")
      }

      // SECURITY: Verify job ownership before returning data
      const ownership = await verifyResourceOwnershipWithIdentifier(
        identifier,
        "job",
        parsedJobId
      )
      if (!ownership.resourceExists) {
        return error("NOT_FOUND", "Generation job not found")
      }
      if (!ownership.authorized) {
        return error("FORBIDDEN", "Access denied to this generation job")
      }

      job = await sql`
        SELECT * FROM generation_jobs WHERE id = ${parsedJobId}
      `.then(rows => rows[0])
    } else {
      const parsedAvatarId = parseInt(avatarId!, 10)
      if (isNaN(parsedAvatarId)) {
        return error("VALIDATION_ERROR", "Invalid avatar_id")
      }

      // SECURITY: Verify avatar ownership before returning job data
      const ownership = await verifyResourceOwnershipWithIdentifier(
        identifier,
        "avatar",
        parsedAvatarId
      )
      if (!ownership.resourceExists) {
        return error("NOT_FOUND", "Avatar not found")
      }
      if (!ownership.authorized) {
        return error("FORBIDDEN", "Access denied to this avatar")
      }

      job = await sql`
        SELECT * FROM generation_jobs
        WHERE avatar_id = ${parsedAvatarId}
        ORDER BY created_at DESC
        LIMIT 1
      `.then(rows => rows[0])
    }

    if (!job) {
      return error("NOT_FOUND", "Generation job not found")
    }

    // Get generated photos
    const photos = await sql`
      SELECT image_url FROM generated_photos
      WHERE avatar_id = ${job.avatar_id} AND style_id = ${job.style_id}
      ORDER BY created_at ASC
    `

    logger.info("Status checked", {
      jobId: job.id,
      status: job.status,
      completed: job.completed_photos,
      total: job.total_photos,
    })

    return success({
      jobId: job.id,
      avatarId: job.avatar_id,
      status: job.status,
      progress: {
        completed: job.completed_photos,
        total: job.total_photos,
        percentage: Math.round((job.completed_photos / job.total_photos) * 100),
      },
      photos: photos.map((p: { image_url: string }) => p.image_url),
      error: job.error_message,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    })
  } catch (err) {
    logger.error("Status check failed", {
      error: err instanceof Error ? err.message : "Unknown",
    })
    return error("DATABASE_ERROR", "Failed to check generation status")
  }
}
