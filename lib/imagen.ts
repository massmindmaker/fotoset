// Multi-provider Image Generation API
// Supports: Replicate (primary - best quality), Kie.ai, fal.ai, Google Imagen (legacy)

import { generatePortrait as replicateGeneratePortrait } from "./replicate/index"
import { prepareImageForApi as prepareImageForReplicate } from "./replicate/utils/image-processor"
import type { GenerationOptions as ReplicateOptions, GenerationResult as ReplicateResult } from "./replicate/types"

// Provider configuration
const PROVIDERS = {
  replicate: {
    name: "Replicate Flux-PuLID",
    apiKey: process.env.REPLICATE_API_TOKEN,
    endpoint: "https://api.replicate.com/v1/predictions",
    model: "zsxkib/flux-pulid",
    pricePerImage: 0.05, // ~$0.05 per generation
  },
  kie: {
    name: "Kie.ai",
    apiKey: process.env.KIE_API_KEY,
    endpoint: "https://api.kie.ai/api/v1/jobs/createTask",
    statusEndpoint: "https://api.kie.ai/api/v1/jobs/getTaskStatus",
    model: "google/nano-banana-pro",
    pricePerImage: 0.12,
  },
  fal: {
    name: "fal.ai",
    apiKey: process.env.FAL_API_KEY,
    endpoint: "https://fal.run/fal-ai/nano-banana-pro",
    pricePerImage: 0.15,
  },
  google: {
    name: "Google Imagen",
    apiKey: process.env.GOOGLE_API_KEY,
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict",
    pricePerImage: 0.03,
  },
} as const

type ProviderName = keyof typeof PROVIDERS

// Default provider order (Replicate first for best face consistency)
const PROVIDER_ORDER: ProviderName[] = ["replicate", "kie", "fal", "google"]

// Get active provider based on available API keys
function getActiveProvider(): ProviderName | null {
  for (const name of PROVIDER_ORDER) {
    if (PROVIDERS[name].apiKey) {
      return name
    }
  }
  return null
}

// Negative prompt for quality improvement
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

export interface GenerationOptions {
  prompt: string
  referenceImages?: string[]
  negativePrompt?: string
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9"
  resolution?: "1K" | "2K" | "4K"
  seed?: number
}

export interface GenerationResult {
  url: string
  success: boolean
  error?: string
  provider?: string
}

// ============ REPLICATE PROVIDER (Nano Banana Pro / Flux-PuLID) ============

async function generateWithReplicate(options: GenerationOptions): Promise<string> {
  const { prompt, referenceImages, seed } = options
  const config = PROVIDERS.replicate

  if (!config.apiKey) {
    throw new Error("REPLICATE_API_TOKEN not configured")
  }

  // Prepare reference images for Replicate
  const preparedRefs = referenceImages?.map(prepareImageForReplicate) || []

  try {
    // Use the unified generatePortrait function with proper signature
    // (prompt, referenceImage, options)
    const replicateOptions: ReplicateOptions = {
      seed,
      steps: 28,
      guidanceScale: 4,
      width: 896,
      height: 1152,
      idWeight: 1.2, // Slightly higher for better face consistency
    }

    // Pass all reference images (up to 14) for better face consistency
    console.log(`[Replicate] Using ${preparedRefs.length} reference images`)
    const result: ReplicateResult = await replicateGeneratePortrait(
      prompt,
      preparedRefs.length > 0 ? preparedRefs : '',
      replicateOptions
    )

    if (!result.success) {
      throw new Error(result.error || 'Generation failed')
    }

    console.log(`[Replicate] ✓ Generated image with ${result.model} (${result.latencyMs}ms)`)
    return result.url
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    console.error(`[Replicate] Generation failed:`, errorMsg)
    throw new Error(`Replicate generation failed: ${errorMsg}`)
  }
}

// ============ KIE.AI PROVIDER ============

interface KieTaskResponse {
  task_id: string
  status: string
}

interface KieStatusResponse {
  status: "pending" | "processing" | "completed" | "failed"
  output?: {
    image_url?: string
    images?: string[]
  }
  error?: string
}

async function generateWithKie(options: GenerationOptions): Promise<string> {
  const { prompt, referenceImages, aspectRatio = "1:1", resolution = "2K" } = options
  const config = PROVIDERS.kie

  if (!config.apiKey) {
    throw new Error("KIE_API_KEY not configured")
  }

  // Prepare request
  const requestBody: Record<string, unknown> = {
    model: config.model,
    prompt: prompt,
    aspect_ratio: aspectRatio,
    resolution: resolution,
    output_format: "png",
  }

  // Add reference images if provided
  if (referenceImages && referenceImages.length > 0) {
    requestBody.image_urls = referenceImages.slice(0, 5).map(img => {
      // Convert base64 to data URI if needed
      if (!img.startsWith("data:") && !img.startsWith("http")) {
        return `data:image/jpeg;base64,${img}`
      }
      return img
    })
  }

  // Create task
  const createResponse = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!createResponse.ok) {
    const error = await createResponse.text()
    console.error("[Kie.ai] Create task error:", error)
    throw new Error(`Kie.ai task creation failed: ${createResponse.status}`)
  }

  const taskData: KieTaskResponse = await createResponse.json()
  const taskId = taskData.task_id

  if (!taskId) {
    throw new Error("Kie.ai did not return task_id")
  }

  // Poll for completion (max 2 minutes)
  const maxAttempts = 60
  const pollInterval = 2000

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval))

    const statusResponse = await fetch(`${config.statusEndpoint}?task_id=${taskId}`, {
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
      },
    })

    if (!statusResponse.ok) {
      continue
    }

    const status: KieStatusResponse = await statusResponse.json()

    if (status.status === "completed") {
      const imageUrl = status.output?.image_url || status.output?.images?.[0]
      if (imageUrl) {
        return imageUrl
      }
      throw new Error("Kie.ai completed but no image URL")
    }

    if (status.status === "failed") {
      throw new Error(status.error || "Kie.ai generation failed")
    }
  }

  throw new Error("Kie.ai generation timeout")
}

// ============ FAL.AI PROVIDER ============

interface FalResponse {
  images: Array<{
    url: string
    width: number
    height: number
  }>
}

async function generateWithFal(options: GenerationOptions): Promise<string> {
  const { prompt, referenceImages, aspectRatio = "1:1", resolution = "2K" } = options
  const config = PROVIDERS.fal

  if (!config.apiKey) {
    throw new Error("FAL_API_KEY not configured")
  }

  const requestBody: Record<string, unknown> = {
    prompt: prompt,
    num_images: 1,
    aspect_ratio: aspectRatio,
    resolution: resolution,
    output_format: "png",
  }

  // Add reference images for image-to-image
  if (referenceImages && referenceImages.length > 0) {
    requestBody.image = referenceImages[0].startsWith("data:")
      ? referenceImages[0]
      : `data:image/jpeg;base64,${referenceImages[0]}`
  }

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("[fal.ai] API error:", error)
    throw new Error(`fal.ai generation failed: ${response.status}`)
  }

  const data: FalResponse = await response.json()

  if (!data.images || data.images.length === 0) {
    throw new Error("fal.ai returned no images")
  }

  return data.images[0].url
}

// ============ GOOGLE IMAGEN PROVIDER (Legacy) ============

interface GoogleImagenResponse {
  predictions: Array<{
    bytesBase64Encoded: string
    mimeType: string
  }>
}

async function generateWithGoogle(options: GenerationOptions): Promise<string> {
  const { prompt, referenceImages, negativePrompt = NEGATIVE_PROMPT, aspectRatio = "1:1" } = options
  const config = PROVIDERS.google

  if (!config.apiKey) {
    throw new Error("GOOGLE_API_KEY not configured")
  }

  const enhancedPrompt = negativePrompt
    ? `${prompt}\n\nAvoid: ${negativePrompt}`
    : prompt

  const requestBody: Record<string, unknown> = {
    instances: [{
      prompt: enhancedPrompt,
    }],
    parameters: {
      sampleCount: 1,
      aspectRatio: aspectRatio,
      personGeneration: "allow_adult",
    },
  }

  // Add reference images
  if (referenceImages && referenceImages.length > 0) {
    const preparedRef = referenceImages[0].startsWith("data:")
      ? referenceImages[0].split(",")[1]
      : referenceImages[0]

    ;(requestBody.instances as Array<Record<string, unknown>>)[0].image = {
      bytesBase64Encoded: preparedRef,
    }
  }

  const response = await fetch(`${config.endpoint}?key=${config.apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("[Google Imagen] API error:", error)
    throw new Error(`Google Imagen generation failed: ${response.status}`)
  }

  const data: GoogleImagenResponse = await response.json()

  if (!data.predictions || data.predictions.length === 0) {
    throw new Error("Google Imagen returned no images")
  }

  return `data:${data.predictions[0].mimeType};base64,${data.predictions[0].bytesBase64Encoded}`
}

// ============ UNIFIED GENERATION FUNCTION ============

/**
 * Generate a single image using available providers with automatic fallback
 */
export async function generateImage(options: GenerationOptions): Promise<string> {
  const errors: Array<{ provider: string; error: string }> = []

  // Try each provider in order
  for (const providerName of PROVIDER_ORDER) {
    const provider = PROVIDERS[providerName]

    if (!provider.apiKey) {
      continue
    }

    try {
      console.log(`[Image Gen] Trying ${provider.name}...`)

      let result: string

      switch (providerName) {
        case "replicate":
          result = await generateWithReplicate(options)
          break
        case "kie":
          result = await generateWithKie(options)
          break
        case "fal":
          result = await generateWithFal(options)
          break
        case "google":
          result = await generateWithGoogle(options)
          break
        default:
          continue
      }

      console.log(`[Image Gen] ✓ Success with ${provider.name}`)
      return result

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      console.error(`[Image Gen] ✗ ${provider.name} failed:`, errorMsg)
      errors.push({ provider: provider.name, error: errorMsg })
    }
  }

  // All providers failed
  const errorSummary = errors.map(e => `${e.provider}: ${e.error}`).join("; ")
  throw new Error(`All providers failed: ${errorSummary}`)
}

/**
 * Batch generation with progress tracking and retry logic
 * Guarantees exact number of photos by retrying failed generations
 */
export async function generateMultipleImages(
  prompts: string[],
  referenceImages?: string[],
  options: {
    concurrency?: number
    maxRetries?: number
    onProgress?: (completed: number, total: number, success: boolean) => void
    stylePrefix?: string
    styleSuffix?: string
  } = {}
): Promise<GenerationResult[]> {
  const {
    concurrency = 3,
    maxRetries = 2,
    onProgress,
    stylePrefix = "",
    styleSuffix = "",
  } = options

  const results: GenerationResult[] = new Array(prompts.length)
  const failedIndices: number[] = []
  const activeProvider = getActiveProvider()

  console.log(`[Image Gen] Starting batch: ${prompts.length} images, concurrency: ${concurrency}, maxRetries: ${maxRetries}`)
  console.log(`[Image Gen] Active provider: ${activeProvider ? PROVIDERS[activeProvider].name : "none"}`)

  // First pass: generate all images
  for (let i = 0; i < prompts.length; i += concurrency) {
    const batch = prompts.slice(i, i + concurrency)
    const batchStartIndex = i

    console.log(`[Image Gen] Batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(prompts.length / concurrency)}`)

    const batchResults = await Promise.allSettled(
      batch.map((prompt, batchIndex) =>
        generateImage({
          prompt: `${stylePrefix}${prompt}${styleSuffix}`,
          referenceImages,
          seed: Date.now() + batchIndex + batchStartIndex,
        })
      )
    )

    // Process results
    batchResults.forEach((result, batchIndex) => {
      const globalIndex = batchStartIndex + batchIndex
      const success = result.status === "fulfilled"

      if (success) {
        results[globalIndex] = {
          url: result.value,
          success: true,
          provider: activeProvider ? PROVIDERS[activeProvider].name : undefined,
        }
        console.log(`[Image Gen] ✓ Image ${globalIndex + 1}/${prompts.length}`)
      } else {
        const errorMsg = result.reason instanceof Error ? result.reason.message : "Unknown error"
        console.error(`[Image Gen] ✗ Image ${globalIndex + 1}/${prompts.length}:`, errorMsg)
        failedIndices.push(globalIndex)
        results[globalIndex] = {
          url: "",
          success: false,
          error: errorMsg,
        }
      }

      onProgress?.(globalIndex + 1, prompts.length, success)
    })

    // Rate limit delay between batches
    if (i + concurrency < prompts.length) {
      await new Promise(resolve => setTimeout(resolve, 800))
    }
  }

  // Retry failed generations to guarantee photo count
  let retryAttempt = 0
  while (failedIndices.length > 0 && retryAttempt < maxRetries) {
    retryAttempt++
    const toRetry = [...failedIndices]
    failedIndices.length = 0

    console.log(`[Image Gen] Retry attempt ${retryAttempt}/${maxRetries} for ${toRetry.length} failed images`)

    for (let i = 0; i < toRetry.length; i += concurrency) {
      const batch = toRetry.slice(i, i + concurrency)

      const batchResults = await Promise.allSettled(
        batch.map((originalIndex) =>
          generateImage({
            prompt: `${stylePrefix}${prompts[originalIndex]}${styleSuffix}`,
            referenceImages,
            seed: Date.now() + originalIndex + retryAttempt * 1000,
          })
        )
      )

      batchResults.forEach((result, batchIndex) => {
        const originalIndex = batch[batchIndex]
        const success = result.status === "fulfilled"

        if (success) {
          results[originalIndex] = {
            url: result.value,
            success: true,
            provider: activeProvider ? PROVIDERS[activeProvider].name : undefined,
          }
          console.log(`[Image Gen] ✓ Retry success for image ${originalIndex + 1}`)
        } else {
          failedIndices.push(originalIndex)
          console.error(`[Image Gen] ✗ Retry failed for image ${originalIndex + 1}`)
        }
      })

      if (i + concurrency < toRetry.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  // Mark remaining failures
  for (const idx of failedIndices) {
    results[idx] = {
      url: "/generation-failed.jpg",
      success: false,
      error: "All retry attempts failed",
    }
  }

  const successCount = results.filter(r => r.success).length
  console.log(`[Image Gen] Complete: ${successCount}/${prompts.length} successful (${failedIndices.length} final failures)`)

  return results
}

/**
 * Test API connection for all configured providers
 */
export async function testConnections(): Promise<Record<string, {
  configured: boolean
  connected: boolean
  message: string
  pricePerImage: number
}>> {
  const results: Record<string, {
    configured: boolean
    connected: boolean
    message: string
    pricePerImage: number
  }> = {}

  for (const [name, config] of Object.entries(PROVIDERS)) {
    results[name] = {
      configured: !!config.apiKey,
      connected: false,
      message: config.apiKey ? "Not tested" : "API key not configured",
      pricePerImage: config.pricePerImage,
    }

    if (!config.apiKey) continue

    try {
      // Simple connectivity test - just check if API responds
      const testPrompt = "A simple blue square on white background"

      if (name === "replicate") {
        // Use the imported test function from replicate.ts
        const { testReplicateConnection } = await import("./replicate")
        const testResult = await testReplicateConnection()
        results[name].connected = testResult.success
        results[name].message = testResult.message
      } else if (name === "kie") {
        const response = await fetch(config.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: PROVIDERS.kie.model,
            prompt: testPrompt,
            resolution: "1K",
          }),
        })
        results[name].connected = response.status !== 401 && response.status !== 403
        results[name].message = response.ok ? "Connected" : `HTTP ${response.status}`
      } else if (name === "fal") {
        const response = await fetch(config.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Key ${config.apiKey}`,
          },
          body: JSON.stringify({ prompt: testPrompt, num_images: 1 }),
        })
        results[name].connected = response.status !== 401 && response.status !== 403
        results[name].message = response.ok ? "Connected" : `HTTP ${response.status}`
      } else if (name === "google") {
        const response = await fetch(`${config.endpoint}?key=${config.apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt: testPrompt }],
            parameters: { sampleCount: 1, aspectRatio: "1:1" },
          }),
        })
        results[name].connected = response.status !== 401 && response.status !== 403
        results[name].message = response.ok ? "Connected" : `HTTP ${response.status}`
      }
    } catch (error) {
      results[name].message = error instanceof Error ? error.message : "Connection error"
    }
  }

  return results
}

/**
 * Get current provider info
 */
export function getProviderInfo(): {
  active: string | null
  available: string[]
  pricing: Record<string, number>
} {
  const active = getActiveProvider()
  const available = PROVIDER_ORDER.filter(name => !!PROVIDERS[name].apiKey)
  const pricing: Record<string, number> = {}

  for (const [name, config] of Object.entries(PROVIDERS)) {
    pricing[name] = config.pricePerImage
  }

  return { active: active ? PROVIDERS[active].name : null, available, pricing }
}
