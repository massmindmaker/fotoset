// Diagnostic endpoint to test Kie.ai API connection
// DELETE AFTER DEBUGGING

import { NextResponse } from "next/server"
import { testKieConnection } from "@/lib/kie"

export const maxDuration = 60

export async function GET() {
  // Temporarily always allow for debugging
  const vercelEnv = process.env.VERCEL_ENV || "unknown"
  const allowDebug = process.env.ALLOW_DEBUG || "not_set"

  const kieAiKey = process.env.KIE_AI_API_KEY?.trim()
  const kieKey = process.env.KIE_API_KEY?.trim()
  const replicateKey = process.env.REPLICATE_API_TOKEN?.trim()

  const envCheck = {
    KIE_AI_API_KEY: kieAiKey ? `SET (${kieAiKey.length} chars, starts: ${kieAiKey.substring(0, 8)}...)` : "NOT SET",
    KIE_API_KEY: kieKey ? `SET (${kieKey.length} chars, starts: ${kieKey.substring(0, 8)}...)` : "NOT SET",
    REPLICATE_API_TOKEN: replicateKey ? `SET (${replicateKey.length} chars)` : "NOT SET",
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: vercelEnv,
    ALLOW_DEBUG: allowDebug,
  }

  console.log("[Debug/Kie] ENV Check:", JSON.stringify(envCheck))

  // Test Kie.ai connection
  const kieTest = await testKieConnection()

  console.log("[Debug/Kie] Connection test:", JSON.stringify(kieTest))

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env: envCheck,
    kieTest,
  })
}
