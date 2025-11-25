// YeScale API интеграция (прокси для Google Gemini/Imagen)

const YESCALE_API_KEY = process.env.YESCALE_API_KEY || "sk-XdPb8LjjBVjQD5JsUW25MAKdzJ3lufQTqlz1v7XST9mBC55B"
const YESCALE_BASE_URL = "https://api.yescale.io/v1beta"

// Модель для генерации изображений
const IMAGEN_MODEL = "imagen-3.0-generate-001"
// Модель для текста (fallback)
const TEXT_MODEL = "gemini-2.0-flash"

export interface ImagenResponse {
  predictions?: Array<{
    bytesBase64Encoded: string
    mimeType: string
  }>
  candidates?: Array<{
    content: {
      parts: Array<{
        inlineData?: {
          mimeType: string
          data: string
        }
        text?: string
      }>
    }
  }>
}

export async function generateImageWithYescale(prompt: string, referenceImages?: string[]): Promise<string> {
  // Пробуем Imagen API через YeScale
  const requestBody = {
    instances: [
      {
        prompt: prompt,
        ...(referenceImages && referenceImages.length > 0 ? { image: { bytesBase64Encoded: referenceImages[0] } } : {}),
      },
    ],
    parameters: {
      sampleCount: 1,
      aspectRatio: "1:1",
      personGeneration: "allow_adult",
    },
  }

  try {
    const response = await fetch(`${YESCALE_BASE_URL}/models/${IMAGEN_MODEL}:predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${YESCALE_API_KEY}`,
        "x-goog-api-key": YESCALE_API_KEY,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] YeScale Imagen error:", response.status, errorText)
      throw new Error(`Imagen API failed: ${response.status}`)
    }

    const data: ImagenResponse = await response.json()

    if (data.predictions && data.predictions.length > 0) {
      return `data:${data.predictions[0].mimeType};base64,${data.predictions[0].bytesBase64Encoded}`
    }

    throw new Error("No image in response")
  } catch (error) {
    console.error("[v0] YeScale generateImage error:", error)
    throw error
  }
}

// Тестовая функция для проверки API
export async function testYescaleConnection(): Promise<{
  success: boolean
  message: string
  availableModels?: string[]
}> {
  try {
    const response = await fetch(`${YESCALE_BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${YESCALE_API_KEY}`,
        "x-goog-api-key": YESCALE_API_KEY,
      },
    })

    if (response.ok) {
      const data = await response.json()
      const models = data.models?.map((m: { name: string }) => m.name) || []
      return {
        success: true,
        message: "Connection successful",
        availableModels: models,
      }
    }

    return {
      success: false,
      message: `API returned ${response.status}`,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Генерация нескольких изображений
export async function generateMultipleImagesWithYescale(
  prompts: string[],
  referenceImages?: string[],
  concurrency = 2,
): Promise<string[]> {
  const results: string[] = []

  for (let i = 0; i < prompts.length; i += concurrency) {
    const batch = prompts.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(
      batch.map((prompt) => generateImageWithYescale(prompt, referenceImages)),
    )

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value)
      } else {
        console.error("[v0] Image generation failed:", result.reason)
        // Добавляем placeholder при ошибке
        results.push("/generation-failed.jpg")
      }
    }
  }

  return results
}
