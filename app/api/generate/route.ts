import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { generateMultipleImages, type GenerationResult } from "@/lib/imagen"
import { PHOTOSET_PROMPTS, STYLE_CONFIGS } from "@/lib/prompts"
import {
  filterAndSortReferenceImages,
  smartMergePrompt,
  enhancePromptForConsistency,
} from "@/lib/image-utils"

// Конфигурация генерации
const GENERATION_CONFIG = {
  concurrency: 3,              // Параллельные запросы (оптимально для API rate limits)
  maxPhotos: 23,               // Максимум фото за генерацию
  maxReferenceImages: 20,      // Используем все изображения пользователя (10-20)
  minReferenceImages: 1,       // Минимум для генерации
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

    // Проверяем существует ли avatar с таким ID
    const existingAvatar = await sql`
      SELECT id FROM avatars WHERE id = ${parseInt(avatarId) || 0} AND user_id = ${user.id}
    `.then((rows) => rows[0])

    if (existingAvatar) {
      dbAvatarId = existingAvatar.id
      console.log(`[Generate] Using existing avatar ${dbAvatarId}`)
    } else {
      // Создаем новый avatar в БД
      const newAvatar = await sql`
        INSERT INTO avatars (user_id, name, status)
        VALUES (${user.id}, 'Мой аватар', 'processing')
        RETURNING id
      `.then((rows) => rows[0])
      dbAvatarId = newAvatar.id
      console.log(`[Generate] Created new avatar ${dbAvatarId} (frontend ID was: ${avatarId})`)
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

    // Создаем задачу генерации
    // Используем photoCount из тира (7/15/23), но не больше доступных промптов
    const requestedPhotos = photoCount && photoCount > 0 ? photoCount : GENERATION_CONFIG.maxPhotos
    const totalPhotos = Math.min(requestedPhotos, PHOTOSET_PROMPTS.length, GENERATION_CONFIG.maxPhotos)

    const job = await sql`
      INSERT INTO generation_jobs (avatar_id, style_id, status, total_photos)
      VALUES (${dbAvatarId}, ${styleId}, 'processing', ${totalPhotos})
      RETURNING *
    `.then((rows) => rows[0])

    console.log(`[Generate] Created job ${job.id} for avatar ${dbAvatarId}, style: ${styleId}, photos: ${totalPhotos} (requested: ${photoCount || 'default'})`)

    // Подготавливаем промпты с умным слиянием
    const basePrompts = PHOTOSET_PROMPTS.slice(0, totalPhotos)
    const mergedPrompts = basePrompts.map(basePrompt =>
      smartMergePrompt({
        basePrompt,
        stylePrefix: styleConfig.promptPrefix,
        styleSuffix: styleConfig.promptSuffix,
      })
    ).map(prompt =>
      // Добавляем улучшения для консистентности
      enhancePromptForConsistency(prompt)
    )

    console.log(`[Generate] Prepared ${mergedPrompts.length} prompts with smart merging`)

    // Batch генерация с прогресс-трекингом
    let completedCount = 0

    const results: GenerationResult[] = await generateMultipleImages(
      mergedPrompts,
      validReferenceImages,
      {
        concurrency: GENERATION_CONFIG.concurrency,
        onProgress: async (completed, total, success) => {
          completedCount = completed

          // Обновляем прогресс в БД каждые 3 фото
          if (completed % 3 === 0 || completed === total) {
            await sql`
              UPDATE generation_jobs
              SET completed_photos = ${completed}, updated_at = NOW()
              WHERE id = ${job.id}
            `.catch(err => console.error("[Generate] Progress update failed:", err))
          }
        },
      }
    )

    // Сохраняем успешные фото в БД
    const successfulPhotos = results.filter(r => r.success)
    const failedCount = results.length - successfulPhotos.length

    for (const result of successfulPhotos) {
      const promptIndex = results.indexOf(result)
      const originalPrompt = mergedPrompts[promptIndex]

      await sql`
        INSERT INTO generated_photos (avatar_id, style_id, prompt, image_url)
        VALUES (${dbAvatarId}, ${styleId}, ${originalPrompt}, ${result.url})
      `.catch(err => console.error(`[Generate] Failed to save photo to DB:`, err))
    }

    // Обновляем статус задачи
    const finalStatus = successfulPhotos.length > 0 ? "completed" : "failed"
    await sql`
      UPDATE generation_jobs
      SET status = ${finalStatus},
          completed_photos = ${successfulPhotos.length},
          error_message = ${failedCount > 0 ? `${failedCount} photos failed to generate` : null},
          updated_at = NOW()
      WHERE id = ${job.id}
    `

    // Обновляем аватар
    if (successfulPhotos.length > 0) {
      await sql`
        UPDATE avatars
        SET status = 'ready',
            thumbnail_url = ${successfulPhotos[0].url},
            updated_at = NOW()
        WHERE id = ${dbAvatarId}
      `
    }

    const elapsedTime = Math.round((Date.now() - startTime) / 1000)
    console.log(`[Generate] Job ${job.id} completed in ${elapsedTime}s: ${successfulPhotos.length}/${totalPhotos} successful`)

    return NextResponse.json({
      success: true,
      jobId: job.id,
      avatarId: dbAvatarId, // Database avatar ID for frontend sync
      photosGenerated: successfulPhotos.length,
      photosFailed: failedCount,
      photos: successfulPhotos.map(r => r.url),
      referenceImagesUsed: validReferenceImages.length,
      referenceImagesRejected: rejected.length,
      elapsedSeconds: elapsedTime,
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
      // Получаем последнюю задачу для аватара
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
