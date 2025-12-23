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
    // Get sample reference images from avatar 7
    const { sql } = await import("@/lib/db")
    const refs = await sql`
      SELECT image_url FROM reference_photos
      WHERE avatar_id = 7
      ORDER BY created_at ASC
      LIMIT 4
    `
    const referenceUrls = refs.map((r: any) => r.image_url)
    console.log("[Test-Kie] Reference images:", referenceUrls.length, "URLs")
    console.log("[Test-Kie] First URL preview:", referenceUrls[0]?.substring(0, 80))

    // Try a simple generation with reference images
    console.log("[Test-Kie] Starting test generation WITH references...")
    const result = await generateWithKie({
      prompt: "Professional portrait photo of a person, studio lighting, clean white background, high quality",
      referenceImages: referenceUrls,
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
