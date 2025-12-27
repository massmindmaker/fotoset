// Image Generation API - Multi-Provider
// Priority: 1) Kie.ai (Nano Banana Pro) 2) Replicate (fallback)

import { generateWithKie, isKieConfigured } from "./kie"
import { generatePortrait as replicateGeneratePortrait } from "./replicate/index"
import { prepareImageForApi as prepareImageForReplicate } from "./replicate/utils/image-processor"
import type { GenerationOptions as ReplicateOptions, GenerationResult as ReplicateResult } from "./replicate/types"

// Re-export for external use
export { testConnections } from "./replicate/index"
export { testKieConnection, isKieConfigured } from "./kie"

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

// ============ KIE.AI PROVIDER (Primary) ============

async function generateWithKieProvider(options: GenerationOptions): Promise<string> {
  const { prompt, referenceImages, seed } = options

  const result = await generateWithKie({
    prompt,
    referenceImages,
    aspectRatio: "3:4", // Portrait
    resolution: "2K",
    outputFormat: "jpg",
    seed,
  })

  if (!result.success) {
    throw new Error(result.error || "Kie.ai generation failed")
  }

  return result.url
}

// ============ REPLICATE PROVIDER (Fallback) ============

async function generateWithReplicate(options: GenerationOptions): Promise<string> {
  const { prompt, referenceImages, seed } = options

  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN not configured")
  }

  // Prepare reference images for Replicate
  const preparedRefs = referenceImages?.map(prepareImageForReplicate) || []

  try {
    // Use the unified generatePortrait function with proper signature
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

    console.log(`[Replicate] Generated image with ${result.model} (${result.latencyMs}ms)`)
    return result.url
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    console.error(`[Replicate] Generation failed:`, errorMsg)
    throw new Error(`Replicate generation failed: ${errorMsg}`)
  }
}

// ============ UNIFIED GENERATION FUNCTION ============

/**
 * Generate a single image using Kie.ai (Nano Banana Pro)
 * No fallback - Kie.ai is the only provider
 */
export async function generateImage(options: GenerationOptions): Promise<string> {
  const kieConfigured = isKieConfigured()
  const kieKey = (process.env.KIE_AI_API_KEY || process.env.KIE_API_KEY)?.trim()
  console.log(`[Image Gen] Kie.ai configured=${kieConfigured}, key length=${kieKey?.length || 0}`)

  if (!kieConfigured) {
    throw new Error("Kie.ai not configured (need KIE_AI_API_KEY)")
  }

  console.log(`[Image Gen] Starting generation with Kie.ai (Nano Banana Pro)...`)
  const result = await generateWithKieProvider(options)
  console.log(`[Image Gen] Success with Kie.ai`)
  return result
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

  const activeProvider = isKieConfigured() ? "Kie.ai" : process.env.REPLICATE_API_TOKEN ? "Replicate" : "None"
  console.log(`[Image Gen] Starting batch: ${prompts.length} images, concurrency: ${concurrency}, maxRetries: ${maxRetries}`)
  console.log(`[Image Gen] Active provider: ${activeProvider}`)

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
          provider: activeProvider,
        }
        console.log(`[Image Gen] Image ${globalIndex + 1}/${prompts.length}`)
      } else {
        const errorMsg = result.reason instanceof Error ? result.reason.message : "Unknown error"
        console.error(`[Image Gen] Image ${globalIndex + 1}/${prompts.length}:`, errorMsg)
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
            provider: activeProvider,
          }
          console.log(`[Image Gen] Retry success for image ${originalIndex + 1}`)
        } else {
          failedIndices.push(originalIndex)
          console.error(`[Image Gen] Retry failed for image ${originalIndex + 1}`)
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
 * Get current provider info
 */
export function getProviderInfo(): {
  active: string | null
  available: string[]
  pricing: Record<string, number>
} {
  const hasKie = isKieConfigured()
  const hasReplicate = !!process.env.REPLICATE_API_TOKEN

  const available: string[] = []
  if (hasKie) available.push("kie")
  if (hasReplicate) available.push("replicate")

  return {
    active: hasKie ? "Kie.ai" : hasReplicate ? "Replicate" : null,
    available,
    pricing: {
      kie: 0.03, // Approximate per image
      replicate: 0.05,
    },
  }
}
