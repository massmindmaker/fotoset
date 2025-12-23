import { NextResponse } from "next/server"
import { isKieConfigured, testKieConnection } from "@/lib/kie"

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
    test: null as { success: boolean; message: string } | null,
  }

  // Test Kie.ai connection
  if (isKieConfigured()) {
    try {
      const testResult = await testKieConnection()
      result.test = testResult
    } catch (error) {
      result.test = {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  return NextResponse.json(result)
}
