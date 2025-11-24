import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { generateImage } from "@/lib/imagen"
import { PHOTOSET_PROMPTS, STYLE_CONFIGS } from "@/lib/prompts"

export async function POST(request: NextRequest) {
  try {
    const { deviceId, avatarId, styleId, referenceImages } = await request.json()

    if (!deviceId || !avatarId || !styleId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Проверяем пользователя
    const user = await sql`
      SELECT * FROM users WHERE device_id = ${deviceId}
    `.then((rows) => rows[0])

    if (!user || !user.is_pro) {
      return NextResponse.json({ error: "Pro subscription required" }, { status: 403 })
    }

    // Получаем конфигурацию стиля
    const styleConfig = STYLE_CONFIGS[styleId as keyof typeof STYLE_CONFIGS]
    if (!styleConfig) {
      return NextResponse.json({ error: "Invalid style" }, { status: 400 })
    }

    // Создаем задачу генерации
    const job = await sql`
      INSERT INTO generation_jobs (avatar_id, style_id, status, total_photos)
      VALUES (${avatarId}, ${styleId}, 'processing', 23)
      RETURNING *
    `.then((rows) => rows[0])

    // Генерируем 23 фото
    const generatedPhotos: string[] = []
    const allPrompts = PHOTOSET_PROMPTS.slice(0, 23) // Берем первые 23 промпта

    for (let i = 0; i < allPrompts.length; i++) {
      try {
        const fullPrompt = `${styleConfig.promptPrefix}${allPrompts[i]}${styleConfig.promptSuffix}`

        const imageUrl = await generateImage(fullPrompt, referenceImages)

        // Сохраняем фото в БД
        await sql`
          INSERT INTO generated_photos (avatar_id, style_id, prompt, image_url)
          VALUES (${avatarId}, ${styleId}, ${fullPrompt}, ${imageUrl})
        `

        generatedPhotos.push(imageUrl)

        // Обновляем прогресс
        await sql`
          UPDATE generation_jobs 
          SET completed_photos = ${i + 1}, updated_at = NOW()
          WHERE id = ${job.id}
        `
      } catch (error) {
        console.error(`Error generating image ${i + 1}:`, error)
        // Продолжаем генерацию даже если одно фото не удалось
      }
    }

    // Обновляем статус задачи
    await sql`
      UPDATE generation_jobs 
      SET status = 'completed', updated_at = NOW()
      WHERE id = ${job.id}
    `

    // Обновляем аватар
    await sql`
      UPDATE avatars 
      SET status = 'ready', thumbnail_url = ${generatedPhotos[0] || null}, updated_at = NOW()
      WHERE id = ${avatarId}
    `

    return NextResponse.json({
      success: true,
      jobId: job.id,
      photosGenerated: generatedPhotos.length,
      photos: generatedPhotos,
    })
  } catch (error) {
    console.error("Generation error:", error)
    return NextResponse.json({ error: "Generation failed" }, { status: 500 })
  }
}
