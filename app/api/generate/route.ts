// maxDuration not needed - all generation runs via QStash (no local fallback)
// Keeping 60s for API validation/response
export const maxDuration = 60

import { type NextRequest } from "next/server"
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
import {
  trackGenerationStarted,
  trackGenerationCompleted,
  trackGenerationFailed,
  trackQStashFallback,
  trackQStashSuccess,
} from "@/lib/sentry-events"
import { autoRefundForFailedGeneration } from "@/lib/tbank"

const logger = createLogger("Generate")

// ============================================================================
// Configuration
// ============================================================================

const GENERATION_CONFIG = {
  concurrency: 7,              // Parallel requests (increased for speed)
  maxPhotos: 23,               // Max photos per generation (production)
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

    // Track generation start in Sentry
    trackGenerationStarted(userId, String(dbAvatarId), styleId, totalPhotos)

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
            `.catch((err: Error) => logger.error("Progress update failed", { jobId, error: err.message }))
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
        `.catch((err: Error) => logger.error("Failed to save photo to DB", { jobId, photoIndex: i, error: err.message }))

        // Set first photo as thumbnail
        if (!firstPhotoUrl) {
          firstPhotoUrl = finalImageUrl
          await sql`
            UPDATE avatars
            SET thumbnail_url = ${finalImageUrl}, updated_at = NOW()
            WHERE id = ${dbAvatarId}
          `.catch((err: Error) => logger.error("Failed to update thumbnail", { avatarId: dbAvatarId, error: err.message }))
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

    // POLICY: If ANY photo failed, refund the entire payment
    // User paid for complete photoset (7/15/23 photos), partial delivery is not acceptable
    if (failedCount > 0) {
      logger.warn("Generation has failed photos - triggering auto-refund", {
        jobId,
        avatarId: dbAvatarId,
        successCount,
        failedCount,
        totalPhotos,
      })

      // Attempt auto-refund
      const refundResult = await autoRefundForFailedGeneration(dbAvatarId, userId)

      if (refundResult.success) {
        logger.info("Auto-refund successful", {
          jobId,
          avatarId: dbAvatarId,
          refundedPaymentId: refundResult.refundedPaymentId,
        })
      } else {
        logger.error("Auto-refund failed", {
          jobId,
          avatarId: dbAvatarId,
          error: refundResult.error,
        })
      }

      // Mark job as failed (partial success = failure for refund policy)
      await sql`
        UPDATE generation_jobs
        SET status = 'failed',
            completed_photos = ${successCount},
            error_message = ${`${failedCount}/${totalPhotos} photos failed - payment refunded`},
            updated_at = NOW()
        WHERE id = ${jobId}
      `

      // Reset avatar to draft (incomplete generation)
      await sql`
        UPDATE avatars
        SET status = 'draft', updated_at = NOW()
        WHERE id = ${dbAvatarId}
      `

      // Track as failure in Sentry
      trackGenerationFailed(userId, String(dbAvatarId), `${failedCount}/${totalPhotos} photos failed`)

      return // Early exit - don't send success notification
    }

    // ALL photos successful - mark as completed
    await sql`
      UPDATE generation_jobs
      SET status = 'completed',
          completed_photos = ${successCount},
          updated_at = NOW()
      WHERE id = ${jobId}
    `

    // Update avatar status to ready
    await sql`
      UPDATE avatars
      SET status = 'ready', updated_at = NOW()
      WHERE id = ${dbAvatarId}
    `

    // Send Telegram notification for successful generation
    try {
      const userWithTelegram = await sql`
        SELECT telegram_user_id FROM users WHERE id = ${userId}
      `.then((rows: any[]) => rows[0])

      if (userWithTelegram?.telegram_user_id && firstPhotoUrl) {
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
    logger.info("Generation completed successfully", {
      jobId,
      avatarId: dbAvatarId,
      successCount,
      totalPhotos,
      elapsedSeconds: elapsedTime,
    })

    // Track generation completion in Sentry
    trackGenerationCompleted(userId, String(dbAvatarId), successCount, elapsedTime * 1000)

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    logger.error("Generation fatal error", { jobId, error: errorMessage })

    // Track generation failure in Sentry
    trackGenerationFailed(userId, String(dbAvatarId), errorMessage)

    // POLICY: Fatal error = auto-refund
    logger.warn("Fatal error - triggering auto-refund", { jobId, avatarId: dbAvatarId })
    const refundResult = await autoRefundForFailedGeneration(dbAvatarId, userId)
    if (refundResult.success) {
      logger.info("Auto-refund successful after fatal error", {
        jobId,
        refundedPaymentId: refundResult.refundedPaymentId,
      })
    } else {
      logger.error("Auto-refund failed after fatal error", {
        jobId,
        error: refundResult.error,
      })
    }

    // Update job status to failed
    await sql`
      UPDATE generation_jobs
      SET status = 'failed',
          error_message = ${`${errorMessage} - payment refunded`},
          updated_at = NOW()
      WHERE id = ${jobId}
    `.catch((e: Error) => logger.error("Failed to update job status", { jobId, error: e.message }))

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
      `.then((rows: any[]) => rows[0])

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

    // Check if user has an AVAILABLE payment (not yet consumed for generation)
    // SECURITY: Each payment can only be used for ONE generation
    const availablePayment = await sql`
      SELECT id, amount, status, tier_id, photo_count FROM payments
      WHERE user_id = ${user.id}
        AND status = 'succeeded'
        AND COALESCE(generation_consumed, FALSE) = FALSE
      ORDER BY created_at DESC
      LIMIT 1
    `.then((rows: any[]) => rows[0])

    if (!availablePayment) {
      // Check if user has ANY payment (to give better error message)
      const anyPayment = await sql`
        SELECT id FROM payments WHERE user_id = ${user.id} AND status = 'succeeded' LIMIT 1
      `.then((rows: any[]) => rows[0])

      if (anyPayment) {
        logger.warn("User has consumed all payments", { userId: user.id, telegramUserId: tgId })
        return error("PAYMENT_CONSUMED", "Ваш платёж уже использован. Для новой генерации необходима новая оплата.", {
          code: "PAYMENT_CONSUMED"
        })
      }

      logger.warn("User has no successful payment", { userId: user.id, telegramUserId: tgId })
      return error("PAYMENT_REQUIRED", "Please complete payment before generating photos", {
        code: "PAYMENT_REQUIRED"
      })
    }

    logger.info("Payment validated (available for generation)", {
      userId: user.id,
      paymentId: availablePayment.id,
      amount: availablePayment.amount,
      tierId: availablePayment.tier_id
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
      `.then((rows: any[]) => rows[0])
    }

    if (existingAvatar) {
      dbAvatarId = existingAvatar.id
      logger.info("Using existing avatar", { avatarId: dbAvatarId })
    } else {
      const newAvatar = await sql`
        INSERT INTO avatars (user_id, name, status)
        VALUES (${user.id}, 'My Avatar', 'processing')
        RETURNING id
      `.then((rows: any[]) => rows[0])
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

    // Get already used prompts for this avatar to avoid duplicates
    const usedPrompts = await sql`
      SELECT DISTINCT prompt FROM generated_photos
      WHERE avatar_id = ${dbAvatarId}
    `.then((rows: any[]) => rows.map(r => r.prompt))

    // Filter out already used prompts
    const availablePrompts = PHOTOSET_PROMPTS.filter(prompt => {
      // Check if this base prompt was already used (compare first 100 chars to handle merged prompts)
      const promptStart = prompt.substring(0, 100)
      return !usedPrompts.some((used: string | null) => used && used.substring(0, 100) === promptStart)
    })

    if (availablePrompts.length === 0) {
      logger.warn("All prompts already used for this avatar", { avatarId: dbAvatarId, usedCount: usedPrompts.length })
      return error("NO_PROMPTS_AVAILABLE", "Все стили уже использованы для этого аватара. Создайте новый аватар для новых фото.")
    }

    const totalPhotos = Math.min(requestedPhotos, availablePrompts.length, GENERATION_CONFIG.maxPhotos)

    // Create generation job with payment_id binding
    const job = await sql`
      INSERT INTO generation_jobs (avatar_id, style_id, status, total_photos, payment_id)
      VALUES (${dbAvatarId}, ${styleId}, 'pending', ${totalPhotos}, ${availablePayment.id})
      RETURNING *
    `.then((rows: any[]) => rows[0])

    // CRITICAL: Mark payment as consumed IMMEDIATELY after job creation
    // This prevents race conditions where same payment could be used for multiple generations
    await sql`
      UPDATE payments
      SET generation_consumed = TRUE,
          consumed_at = NOW(),
          consumed_avatar_id = ${dbAvatarId}
      WHERE id = ${availablePayment.id}
    `

    logger.info("Generation job created, payment consumed", {
      jobId: job.id,
      avatarId: dbAvatarId,
      styleId,
      requestedPhotos,
      totalPhotos,
      paymentId: availablePayment.id,
      availablePrompts: availablePrompts.length,
      usedPrompts: usedPrompts.length,
    })

    // Prepare prompts with style (only unused prompts)
    const basePrompts = availablePrompts.slice(0, totalPhotos)
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

    // ============================================================================
    // QSTASH ONLY - No local fallback (local mode times out on Vercel)
    // ============================================================================

    if (!HAS_QSTASH) {
      // QStash not configured - cannot process generation reliably
      logger.error("QStash not configured - cannot start generation", { jobId: job.id })

      // Mark job as failed
      await sql`
        UPDATE generation_jobs
        SET status = 'failed', error_message = 'QStash not configured - generation unavailable'
        WHERE id = ${job.id}
      `

      // Auto-refund the payment
      const refundResult = await autoRefundForFailedGeneration(dbAvatarId, user.id)
      logger.warn("Auto-refund triggered due to QStash unavailable", {
        jobId: job.id,
        refundSuccess: refundResult.success,
        refundedPaymentId: refundResult.refundedPaymentId,
      })

      return error("SERVICE_UNAVAILABLE", "Generation service temporarily unavailable. Payment has been refunded.", {
        refunded: refundResult.success,
      })
    }

    // Use QStash for reliable background processing (survives Vercel timeout)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "http://localhost:3000"

    logger.info("Publishing to QStash", { baseUrl, jobId: job.id })

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
        prompts: mergedPrompts, // Pass explicit prompts to avoid duplicates
      },
      baseUrl
    )

    if (!qstashResult) {
      // QStash publish failed - do NOT fallback to local (will timeout)
      logger.error("Failed to publish to QStash - aborting generation", { jobId: job.id })
      trackQStashFallback(job.id, dbAvatarId, "publishGenerationJob returned null - NO LOCAL FALLBACK")

      // Mark job as failed
      await sql`
        UPDATE generation_jobs
        SET status = 'failed', error_message = 'Failed to queue generation job'
        WHERE id = ${job.id}
      `

      // Auto-refund the payment
      const refundResult = await autoRefundForFailedGeneration(dbAvatarId, user.id)
      logger.warn("Auto-refund triggered due to QStash publish failure", {
        jobId: job.id,
        refundSuccess: refundResult.success,
        refundedPaymentId: refundResult.refundedPaymentId,
      })

      return error("QUEUE_FAILED", "Failed to start generation. Payment has been refunded.", {
        refunded: refundResult.success,
      })
    }

    logger.info("Job published to QStash successfully", {
      messageId: qstashResult.messageId,
      jobId: job.id,
      avatarId: dbAvatarId,
      totalPhotos,
    })
    trackQStashSuccess(job.id, qstashResult.messageId)

    // Return immediately with job info for polling
    return success({
      jobId: job.id,
      avatarId: dbAvatarId,
      status: "processing",
      totalPhotos,
      referenceImagesUsed: validReferenceImages.length,
      referenceImagesRejected: rejected.length,
      style: styleConfig.name,
      processingMode: "qstash",
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
      `.then((rows: any[]) => rows[0])
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
      `.then((rows: any[]) => rows[0])
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
