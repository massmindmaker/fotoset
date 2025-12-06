// Google Imagen 3.0 API интеграция
// Улучшенная версия с batch генерацией, negative prompts и множественными reference images

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!
const IMAGEN_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict"

// Глобальный negative prompt для улучшения качества портретов
const NEGATIVE_PROMPT = [
  "deformed", "distorted", "disfigured", "mutated",
  "bad anatomy", "wrong anatomy", "extra limbs", "missing limbs",
  "floating limbs", "disconnected limbs", "extra fingers", "missing fingers",
  "blurry", "low quality", "low resolution", "pixelated",
  "watermark", "signature", "text", "logo",
  "duplicate face", "multiple faces", "clone",
  "bad proportions", "cropped", "out of frame",
  "ugly", "tiling", "poorly drawn face", "poorly drawn hands",
  "mutation", "extra head", "extra body",
].join(", ")

export interface ImagenResponse {
  predictions: Array<{
    bytesBase64Encoded: string
    mimeType: string
  }>
}

export interface GenerationOptions {
  prompt: string
  referenceImages?: string[]
  negativePrompt?: string
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9"
  guidanceScale?: number // 1-20, влияет на соответствие промпту
  seed?: number
}

export interface GenerationResult {
  url: string
  success: boolean
  error?: string
}

/**
 * Подготовка референсных изображений для API
 * Используем все изображения пользователя для максимальной консистентности
 */
function prepareReferenceImages(images: string[], maxImages = 20): string[] {
  if (!images || images.length === 0) return []

  return images.slice(0, maxImages).map(img => {
    // Убираем data URI префикс если есть
    if (img.startsWith("data:")) {
      return img.split(",")[1]
    }
    return img
  })
}

/**
 * Генерация одного изображения через Imagen API
 */
export async function generateImage(
  options: GenerationOptions
): Promise<string> {
  const {
    prompt,
    referenceImages = [],
    negativePrompt = NEGATIVE_PROMPT,
    aspectRatio = "1:1",
    guidanceScale,
    seed,
  } = options

  // Формируем расширенный промпт с negative prompt
  const enhancedPrompt = negativePrompt
    ? `${prompt}\n\nAvoid: ${negativePrompt}`
    : prompt

  // Подготавливаем все референсные изображения для максимальной консистентности
  const preparedReferences = prepareReferenceImages(referenceImages, 20)

  const requestBody: Record<string, unknown> = {
    instances: [
      {
        prompt: enhancedPrompt,
      },
    ],
    parameters: {
      sampleCount: 1,
      aspectRatio: aspectRatio,
      personGeneration: "allow_adult",
      // Добавляем guidanceScale если указан (влияет на соответствие промпту vs креативность)
      ...(guidanceScale && { guidanceScale }),
      // Добавляем seed для воспроизводимости
      ...(seed && { seed }),
    },
  }

  // Добавляем референсные изображения для консистентности лица
  // Imagen 3 использует все предоставленные изображения для лучшего понимания субъекта
  if (preparedReferences.length > 0) {
    // Основное референсное изображение (главное лицо)
    (requestBody.instances as Array<Record<string, unknown>>)[0].image = {
      bytesBase64Encoded: preparedReferences[0],
    }

    // Дополнительные референсы для улучшения консистентности (если поддерживается)
    if (preparedReferences.length > 1) {
      (requestBody.instances as Array<Record<string, unknown>>)[0].referenceImages =
        preparedReferences.slice(1).map(img => ({
          bytesBase64Encoded: img,
        }))
    }
  }

  const response = await fetch(`${IMAGEN_API_URL}?key=${GOOGLE_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("[Imagen] API error:", error)
    throw new Error(`Imagen generation failed: ${response.status}`)
  }

  const data: ImagenResponse = await response.json()

  if (!data.predictions || data.predictions.length === 0) {
    throw new Error("No image generated")
  }

  // Возвращаем base64 изображение как data URI
  return `data:${data.predictions[0].mimeType};base64,${data.predictions[0].bytesBase64Encoded}`
}

/**
 * Batch генерация с улучшенной обработкой ошибок
 * Использует Promise.allSettled для graceful error handling
 */
export async function generateMultipleImages(
  prompts: string[],
  referenceImages?: string[],
  options: {
    concurrency?: number
    onProgress?: (completed: number, total: number, success: boolean) => void
    stylePrefix?: string
    styleSuffix?: string
  } = {}
): Promise<GenerationResult[]> {
  const {
    concurrency = 3,
    onProgress,
    stylePrefix = "",
    styleSuffix = "",
  } = options

  const results: GenerationResult[] = []
  const errors: Array<{ index: number; error: string }> = []

  console.log(`[Imagen] Starting batch generation: ${prompts.length} images, concurrency: ${concurrency}`)

  // Обрабатываем батчами для контроля нагрузки на API
  for (let i = 0; i < prompts.length; i += concurrency) {
    const batch = prompts.slice(i, i + concurrency)
    const batchStartIndex = i

    console.log(`[Imagen] Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(prompts.length / concurrency)} (${batch.length} images)`)

    const batchResults = await Promise.allSettled(
      batch.map((prompt, batchIndex) =>
        generateImage({
          prompt: `${stylePrefix}${prompt}${styleSuffix}`,
          referenceImages,
          seed: Date.now() + batchIndex + batchStartIndex, // Уникальный seed для каждого изображения
        })
      )
    )

    // Обрабатываем результаты батча
    batchResults.forEach((result, batchIndex) => {
      const globalIndex = batchStartIndex + batchIndex
      const success = result.status === "fulfilled"

      if (success) {
        results.push({
          url: result.value,
          success: true,
        })
        console.log(`[Imagen] ✓ Image ${globalIndex + 1}/${prompts.length} generated`)
      } else {
        const errorMsg = result.reason instanceof Error ? result.reason.message : "Unknown error"
        console.error(`[Imagen] ✗ Image ${globalIndex + 1}/${prompts.length} failed:`, errorMsg)
        errors.push({ index: globalIndex, error: errorMsg })

        // Добавляем placeholder при ошибке
        results.push({
          url: "/generation-failed.jpg",
          success: false,
          error: errorMsg,
        })
      }

      // Callback для отслеживания прогресса
      onProgress?.(globalIndex + 1, prompts.length, success)
    })

    // Задержка между батчами для соблюдения rate limits
    if (i + concurrency < prompts.length) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  // Логируем итоговую статистику
  const successCount = results.filter(r => r.success).length
  console.log(`[Imagen] Generation complete: ${successCount}/${prompts.length} successful`)

  if (errors.length > 0) {
    console.warn(`[Imagen] ${errors.length} generation(s) failed:`, errors)
  }

  return results
}

/**
 * Проверка доступности API и конфигурации
 */
export async function testImagenConnection(): Promise<{
  success: boolean
  message: string
  apiKeyConfigured: boolean
}> {
  if (!GOOGLE_API_KEY) {
    return {
      success: false,
      message: "GOOGLE_API_KEY is not configured",
      apiKeyConfigured: false,
    }
  }

  try {
    // Простой тест - генерируем минимальное изображение
    const testPrompt = "A simple blue square on white background, minimal, abstract"

    const response = await fetch(`${IMAGEN_API_URL}?key=${GOOGLE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: testPrompt }],
        parameters: { sampleCount: 1, aspectRatio: "1:1" },
      }),
    })

    if (response.ok) {
      return {
        success: true,
        message: "Imagen API connected successfully",
        apiKeyConfigured: true,
      }
    } else {
      const error = await response.text()
      return {
        success: false,
        message: `API error: ${response.status} - ${error}`,
        apiKeyConfigured: true,
      }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown connection error",
      apiKeyConfigured: true,
    }
  }
}
