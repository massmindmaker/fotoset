import { NextResponse } from "next/server"
import { isKieConfigured, generateWithKie } from "@/lib/kie"

export async function GET() {
  const kieKey = process.env.KIE_API_KEY?.trim()
  const replicateKey = process.env.REPLICATE_API_TOKEN?.trim()

  const result = {
    kie: {
      configured: isKieConfigured(),
      keyLength: kieKey?.length || 0,
      keyPrefix: kieKey?.substring(0, 8) || "not set",
    },
    replicate: {
      configured: !!replicateKey,
      keyLength: replicateKey?.length || 0,
    },
    generation: null as { success: boolean; url?: string; error?: string; latencyMs?: number } | null,
  }

  // Test actual Kie.ai generation
  if (isKieConfigured()) {
    try {
      console.log("[test-kie] Starting test generation...")
      const genResult = await generateWithKie({
        prompt: "A professional headshot portrait, studio lighting, high quality",
        aspectRatio: "3:4",
        outputFormat: "jpg",
      })
      console.log("[test-kie] Generation result:", genResult)
      result.generation = {
        success: genResult.success,
        url: genResult.url,
        error: genResult.error,
        latencyMs: genResult.latencyMs,
      }
    } catch (error) {
      result.generation = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  return NextResponse.json(result)
}
