import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { generateMultipleImages, type GenerationResult } from "@/lib/imagen"
import { PHOTOSET_PROMPTS, STYLE_CONFIGS } from "@/lib/prompts"
import {
  filterAndSortReferenceImages,
  smartMergePrompt,
  enhancePromptForConsistency,
} from "@/lib/image-utils"
import { sendGenerationNotification } from "@/lib/telegram-notify"

// Конфигурация генерации
const GENERATION_CONFIG = {
  concurrency: 7,              // Параллельные запросы (увеличено для скорости)
  maxPhotos: 23,               // Максимум фото за генерацию
  maxReferenceImages: 20,      // Используем все изображения пользователя (10-20)
  minReferenceImages: 1,       // Минимум для генерации
  maxRetries: 2,               // Максимум попыток для failed генераций
}

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
    console.log(`[Generate Background] Starting job ${jobId} for avatar ${dbAvatarId}`)

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
            `.catch(err => console.error("[Generate Background] Progress update failed:", err))
          }
        },
      }
    )

    // Save each successful photo to DB immediately
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.success && result.url) {
        successCount++
        const originalPrompt = mergedPrompts[i]

        // Save photo to DB
        await sql`
          INSERT INTO generated_photos (avatar_id, style_id, prompt, image_url)
          VALUES (${dbAvatarId}, ${styleId}, ${originalPrompt}, ${result.url})
        `.catch(err => console.error(`[Generate Background] Failed to save photo ${i} to DB:`, err))

        // Set first photo as thumbnail
        if (!firstPhotoUrl) {
          firstPhotoUrl = result.url
          await sql`
            UPDATE avatars
            SET thumbnail_url = ${result.url}, updated_at = NOW()
            WHERE id = ${dbAvatarId}
          `.catch(err => console.error("[Generate Background] Failed to update thumbnail:", err))
        }
      } else {
        failedCount++
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
        console.log(`[Generate Background] Telegram notification sent to user ${userWithTelegram.telegram_user_id}`)
      }
    } catch (notifyError) {
      console.error("[Generate Background] Telegram notification failed:", notifyError)
    }

    const elapsedTime = Math.round((Date.now() - startTime) / 1000)
    console.log(`[Generate Background] Job ${jobId} completed in ${elapsedTime}s: ${successCount}/${totalPhotos} successful`)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`[Generate Background] Job ${jobId} fatal error:`, errorMessage)

    // Update job status to failed
    await sql`
      UPDATE generation_jobs
      SET status = 'failed',
          error_message = ${errorMessage},
          updated_at = NOW()
      WHERE id = ${jobId}
    `.catch(err => console.error("[Generate Background] Failed to update job status:", err))

    // Reset avatar status
    await sql`
      UPDATE avatars
      SET status = 'draft', updated_at = NOW()
      WHERE id = ${dbAvatarId}
    `.catch(() => {})
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { deviceId, avatarId, styleId, referenceImages, photoCount } = await request.json()

    // Валидация входных данных
    if (!deviceId || !avatarId || !styleId) {
      return NextResponse.json(
        { error: "Missing required fields: deviceId, avatarId, styleId" },
        { status: 400 }
      )
    }

    if (!referenceImages || referenceImages.length === 0) {
      return NextResponse.json(
        { error: "At least one reference image is required" },
        { status: 400 }
      )
    }

    // Проверяем или создаем пользователя
    let user = await sql`
      SELECT * FROM users WHERE device_id = ${deviceId}
    `.then((rows) => rows[0])

    if (!user) {
      // Создаем пользователя если не существует
      user = await sql`
        INSERT INTO users (device_id) VALUES (${deviceId})
        RETURNING *
      `.then((rows) => rows[0])
      console.log(`[Generate] Created new user ${user.id} for device ${deviceId}`)
    }

    // Проверяем avatar - если это timestamp string от фронтенда, создаем новый в БД
    let dbAvatarId: number

    // PostgreSQL INTEGER max = 2,147,483,647
    // Frontend генерирует ID как Date.now() (~1.7 trillion), что переполняет INTEGER
    const parsedAvatarId = parseInt(avatarId)
    const isValidDbId = !isNaN(parsedAvatarId) && parsedAvatarId > 0 && parsedAvatarId <= 2147483647

    let existingAvatar = null
    if (isValidDbId) {
      // Только если ID в валидном диапазоне INTEGER, ищем в БД
      existingAvatar = await sql`
        SELECT id FROM avatars WHERE id = ${parsedAvatarId} AND user_id = ${user.id}
      `.then((rows) => rows[0])
    }

    if (existingAvatar) {
      dbAvatarId = existingAvatar.id
      console.log(`[Generate] Using existing avatar ${dbAvatarId}`)
    } else {
      // Создаем новый avatar в БД (frontend ID был timestamp-based или не найден)
      const newAvatar = await sql`
        INSERT INTO avatars (user_id, name, status)
        VALUES (${user.id}, 'Мой аватар', 'processing')
        RETURNING id
      `.then((rows) => rows[0])
      dbAvatarId = newAvatar.id
      console.log(`[Generate] Created new avatar ${dbAvatarId} (frontend ID was: ${avatarId}, valid DB ID: ${isValidDbId})`)
    }

    // Получаем конфигурацию стиля
    const styleConfig = STYLE_CONFIGS[styleId as keyof typeof STYLE_CONFIGS]
    if (!styleConfig) {
      return NextResponse.json(
        { error: `Invalid style: ${styleId}. Available: ${Object.keys(STYLE_CONFIGS).join(", ")}` },
        { status: 400 }
      )
    }

    // Валидация и фильтрация референсных изображений
    console.log(`[Generate] Validating ${referenceImages.length} reference images...`)
    const { selected: validReferenceImages, rejected } = filterAndSortReferenceImages(
      referenceImages,
      GENERATION_CONFIG.maxReferenceImages
    )

    if (rejected.length > 0) {
      console.warn(`[Generate] Rejected ${rejected.length} images:`, rejected)
    }

    if (validReferenceImages.length < GENERATION_CONFIG.minReferenceImages) {
      return NextResponse.json(
        {
          error: "No valid reference images. Please upload clear photos.",
          rejectedImages: rejected,
        },
        { status: 400 }
      )
    }

    console.log(`[Generate] Using ${validReferenceImages.length} reference images`)

    // Сохраняем референсные изображения в БД для повторного использования
    console.log(`[Generate] Saving ${validReferenceImages.length} reference images to DB...`)
    let savedCount = 0
    try {
      const insertPromises = validReferenceImages.map(imageUrl =>
        sql`INSERT INTO reference_photos (avatar_id, image_url) VALUES (${dbAvatarId}, ${imageUrl})`
      )
      const results = await Promise.allSettled(insertPromises)
      savedCount = results.filter(r => r.status === 'fulfilled').length
      const failedCount = results.filter(r => r.status === 'rejected').length
      if (failedCount > 0) {
        console.warn(`[Generate] ${failedCount}/${validReferenceImages.length} reference photos failed to save`)
      }
    } catch (err) {
      console.error(`[Generate] Failed to save reference photos:`, err)
    }
    console.log(`[Generate] Saved ${savedCount}/${validReferenceImages.length} reference images for avatar ${dbAvatarId}`)

    // Создаем задачу генерации
    // ВАЖНО: Количество фото определяется ТОЛЬКО запросом пользователя (7/15/23)
    // Стили влияют только на оформление промптов, НЕ на количество
    const requestedPhotos = photoCount && photoCount > 0 ? photoCount : GENERATION_CONFIG.maxPhotos
    const totalPhotos = Math.min(requestedPhotos, PHOTOSET_PROMPTS.length, GENERATION_CONFIG.maxPhotos)

    const job = await sql`
      INSERT INTO generation_jobs (avatar_id, style_id, status, total_photos)
      VALUES (${dbAvatarId}, ${styleId}, 'processing', ${totalPhotos})
      RETURNING *
    `.then((rows) => rows[0])

    console.log(`[Generate] Created job ${job.id} for avatar ${dbAvatarId}, style: ${styleId}, requested: ${requestedPhotos}, generating: ${totalPhotos}`)

    // Берём первые N промптов из полного списка (23 промпта доступно)
    // Стиль применяется через prefix/suffix, но не ограничивает количество
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

    console.log(`[Generate] Prepared ${mergedPrompts.length} prompts with smart merging`)

    // Start background generation without awaiting
    // This allows the API to return immediately while generation continues
    Promise.resolve().then(() => {
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

    // Return immediately with job info for polling
    return NextResponse.json({
      success: true,
      jobId: job.id,
      avatarId: dbAvatarId,
      status: "processing",
      totalPhotos,
      referenceImagesUsed: validReferenceImages.length,
      referenceImagesRejected: rejected.length,
      style: styleConfig.name,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Generate] Fatal error:", errorMessage)

    return NextResponse.json(
      {
        error: "Generation failed",
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint для проверки статуса генерации
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const jobId = searchParams.get("job_id")
  const avatarId = searchParams.get("avatar_id")

  if (!jobId && !avatarId) {
    return NextResponse.json(
      { error: "Either job_id or avatar_id is required" },
      { status: 400 }
    )
  }

  try {
    let job

    if (jobId) {
      job = await sql`
        SELECT * FROM generation_jobs WHERE id = ${jobId}
      `.then(rows => rows[0])
    } else {
      job = await sql`
        SELECT * FROM generation_jobs
        WHERE avatar_id = ${avatarId}
        ORDER BY created_at DESC
        LIMIT 1
      `.then(rows => rows[0])
    }

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Получаем сгенерированные фото
    const photos = await sql`
      SELECT image_url FROM generated_photos
      WHERE avatar_id = ${job.avatar_id} AND style_id = ${job.style_id}
      ORDER BY created_at ASC
    `

    return NextResponse.json({
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
  } catch (error) {
    console.error("[Generate] Status check error:", error)
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    )
  }
}
