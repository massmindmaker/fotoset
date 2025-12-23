// Test Kie.ai generation endpoint
// REMOVE AFTER DEBUGGING

import { NextResponse } from "next/server"
import { isKieConfigured, generateWithKie, testKieConnection } from "@/lib/kie"

export async function GET() {
  const startTime = Date.now()

  try {
    // Check configuration
    const configured = isKieConfigured()
    const kieAiKey = process.env.KIE_AI_API_KEY?.trim()
    const kieKey = process.env.KIE_API_KEY?.trim()

    console.log("[Test-Kie] Config check:", {
      configured,
      KIE_AI_API_KEY_length: kieAiKey?.length || 0,
      KIE_API_KEY_length: kieKey?.length || 0,
    })

    if (!configured) {
      return NextResponse.json({
        success: false,
        error: "Kie.ai not configured",
        env: {
          KIE_AI_API_KEY: kieAiKey ? "SET" : "NOT_SET",
          KIE_API_KEY: kieKey ? "SET" : "NOT_SET",
        }
      })
    }

    // Skip connection test (uses deprecated endpoint), go straight to generation
    // Try a simple generation
    console.log("[Test-Kie] Starting test generation...")
    const result = await generateWithKie({
      prompt: "Professional portrait photo of a person, studio lighting, clean white background, high quality",
      aspectRatio: "3:4",
      resolution: "1K",  // Use 1K for faster test
      outputFormat: "jpg",
    })

    const elapsedMs = Date.now() - startTime
    console.log("[Test-Kie] Generation result:", { success: result.success, latencyMs: result.latencyMs })

    return NextResponse.json({
      success: result.success,
      url: result.url,
      latencyMs: result.latencyMs,
      totalElapsedMs: elapsedMs,
      taskId: result.taskId,
      error: result.error,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[Test-Kie] Error:", errorMsg)

    return NextResponse.json({
      success: false,
      error: errorMsg,
      elapsedMs: Date.now() - startTime,
    })
  }
}
