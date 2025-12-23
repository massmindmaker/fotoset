// Kie.ai Nano Banana Pro Provider
// Primary provider for image generation using Google Gemini 3.0 Pro Image

const KIE_API_URL = "https://api.kie.ai/api/v1/jobs/createTask"
const KIE_STATUS_URL = "https://api.kie.ai/api/v1/jobs/recordInfo"

export interface KieGenerationOptions {
  prompt: string
  referenceImages?: string[]
  aspectRatio?: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9"
  resolution?: "1K" | "2K" | "4K"
  outputFormat?: "png" | "jpg"
  seed?: number
}

export interface KieGenerationResult {
  url: string
  success: boolean
  error?: string
  latencyMs: number
  taskId?: string
}

/**
 * Check if Kie.ai API is configured
 */
export function isKieConfigured(): boolean {
  // Use KIE_AI_API_KEY (renamed from KIE_API_KEY to bypass Vercel env cache bug)
  return !!(process.env.KIE_AI_API_KEY || process.env.KIE_API_KEY)
}

/**
 * Generate image using Kie.ai Nano Banana Pro API
 */
export async function generateWithKie(options: KieGenerationOptions): Promise<KieGenerationResult> {
  // Use KIE_AI_API_KEY (renamed from KIE_API_KEY to bypass Vercel env cache bug)
  const apiKey = (process.env.KIE_AI_API_KEY || process.env.KIE_API_KEY)?.trim()

  if (!apiKey) {
    throw new Error("KIE_API_KEY not configured")
  }

  const startTime = Date.now()

  try {
    // Prepare input with reference images if provided
    const input: Record<string, unknown> = {
      prompt: options.prompt,
      output_format: options.outputFormat || "jpg",
      image_size: options.aspectRatio || "3:4", // Portrait by default
    }

    // Add reference images if provided (Nano Banana Pro supports up to 14)
    if (options.referenceImages && options.referenceImages.length > 0) {
      input.image_input = options.referenceImages.slice(0, 14)
    }

    if (options.seed) {
      input.seed = options.seed
    }

    console.log(`[Kie.ai] Creating task with ${options.referenceImages?.length || 0} reference images`)

    // Create task
    const createResponse = await fetch(KIE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nano-banana-pro",
        input,
      }),
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      throw new Error(`Kie.ai task creation failed: ${createResponse.status} - ${errorText}`)
    }

    const createData = await createResponse.json()
    const taskId = createData.data?.taskId || createData.taskId

    if (!taskId) {
      throw new Error("No taskId returned from Kie.ai")
    }

    console.log(`[Kie.ai] Task created: ${taskId}`)

    // Poll for result (max 6 minutes with error tolerance)
    // Kie.ai can take 3-5 minutes for complex generations
    const maxWaitTime = 360000  // 6 minutes to be safe
    const pollInterval = 3000   // Poll every 3 seconds to reduce API load
    let elapsed = 0
    let consecutiveErrors = 0
    const MAX_CONSECUTIVE_ERRORS = 5  // Allow some network hiccups

    while (elapsed < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))
      elapsed += pollInterval

      const statusResponse = await fetch(`${KIE_STATUS_URL}?taskId=${taskId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      })

      if (!statusResponse.ok) {
        consecutiveErrors++
        console.warn(`[Kie.ai] Status check failed: ${statusResponse.status} (error ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})`)
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          throw new Error(`Kie.ai polling failed after ${consecutiveErrors} consecutive errors`)
        }
        continue
      }

      // Reset error counter on successful response
      consecutiveErrors = 0

      const statusData = await statusResponse.json()
      const status = statusData.data?.state || statusData.data?.status || statusData.status

      if (status === "success" || status === "SUCCESS" || status === "COMPLETED") {
        // Parse resultJson if it's a string
        let outputUrl = ""
        if (statusData.data?.resultJson) {
          try {
            const resultJson = typeof statusData.data.resultJson === "string"
              ? JSON.parse(statusData.data.resultJson)
              : statusData.data.resultJson
            outputUrl = resultJson.resultUrls?.[0] || resultJson.url || ""
          } catch {
            // Fallback to other paths
          }
        }

        // Fallback to other possible paths
        if (!outputUrl) {
          outputUrl = statusData.data?.output?.url ||
                      statusData.data?.output?.[0]?.url ||
                      statusData.data?.url ||
                      statusData.output?.url || ""
        }

        if (!outputUrl) {
          throw new Error("No output URL in completed task")
        }

        const latencyMs = Date.now() - startTime
        console.log(`[Kie.ai] Generation complete (${latencyMs}ms)`)

        return {
          url: outputUrl,
          success: true,
          latencyMs,
          taskId,
        }
      }

      if (status === "failed" || status === "FAILED" || status === "ERROR") {
        const errorMsg = statusData.data?.failMsg || statusData.data?.error || statusData.error || "Unknown error"
        throw new Error(`Kie.ai generation failed: ${errorMsg}`)
      }

      console.log(`[Kie.ai] Status: ${status}, elapsed: ${elapsed}ms`)
    }

    throw new Error("Kie.ai generation timeout (6 minutes)")

  } catch (error) {
    const latencyMs = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    console.error(`[Kie.ai] Error:`, errorMsg)

    return {
      url: "",
      success: false,
      error: errorMsg,
      latencyMs,
    }
  }
}

/**
 * Test Kie.ai connection
 */
export async function testKieConnection(): Promise<{ success: boolean; message: string }> {
  if (!isKieConfigured()) {
    return { success: false, message: "KIE_API_KEY not configured" }
  }

  try {
    // Just verify API key works by checking a simple endpoint
    const response = await fetch("https://api.kie.ai/api/v1/user/info", {
      headers: {
        "Authorization": `Bearer ${process.env.KIE_API_KEY}`,
      },
    })

    if (response.ok) {
      return { success: true, message: "Kie.ai connected successfully" }
    }

    return { success: false, message: `API returned ${response.status}` }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    return { success: false, message: msg }
  }
}
