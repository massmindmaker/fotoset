// Google Imagen API интеграция

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!
const IMAGEN_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict"

export interface ImagenResponse {
  predictions: Array<{
    bytesBase64Encoded: string
    mimeType: string
  }>
}

export async function generateImage(prompt: string, referenceImages?: string[]): Promise<string> {
  // Формируем запрос к Imagen API
  const requestBody: {
    instances: Array<{
      prompt: string
      image?: { bytesBase64Encoded: string }
    }>
    parameters: {
      sampleCount: number
      aspectRatio?: string
      personGeneration?: string
    }
  } = {
    instances: [
      {
        prompt: prompt,
      },
    ],
    parameters: {
      sampleCount: 1,
      aspectRatio: "1:1",
      personGeneration: "allow_adult", // Разрешаем генерацию людей
    },
  }

  // Если есть референсные изображения, добавляем их
  if (referenceImages && referenceImages.length > 0) {
    requestBody.instances[0].image = {
      bytesBase64Encoded: referenceImages[0], // Используем первое изображение как референс
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
    console.error("Imagen API error:", error)
    throw new Error(`Imagen generation failed: ${response.status}`)
  }

  const data: ImagenResponse = await response.json()

  if (!data.predictions || data.predictions.length === 0) {
    throw new Error("No image generated")
  }

  // Возвращаем base64 изображение
  return `data:${data.predictions[0].mimeType};base64,${data.predictions[0].bytesBase64Encoded}`
}

// Генерация нескольких изображений параллельно (с ограничением)
export async function generateMultipleImages(
  prompts: string[],
  referenceImages?: string[],
  concurrency = 3,
): Promise<string[]> {
  const results: string[] = []

  for (let i = 0; i < prompts.length; i += concurrency) {
    const batch = prompts.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map((prompt) => generateImage(prompt, referenceImages)))
    results.push(...batchResults)
  }

  return results
}
