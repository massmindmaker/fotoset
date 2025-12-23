// Debug endpoint to check environment variables
// REMOVE AFTER DEBUGGING

import { NextResponse } from "next/server"

export async function GET() {
  const kieAiKey = process.env.KIE_AI_API_KEY?.trim()
  const kieKey = process.env.KIE_API_KEY?.trim()
  const replicateKey = process.env.REPLICATE_API_TOKEN?.trim()

  return NextResponse.json({
    KIE_AI_API_KEY: {
      exists: !!kieAiKey,
      length: kieAiKey?.length || 0,
      first5: kieAiKey?.substring(0, 5) || "NOT_SET",
    },
    KIE_API_KEY: {
      exists: !!kieKey,
      length: kieKey?.length || 0,
      first5: kieKey?.substring(0, 5) || "NOT_SET",
    },
    REPLICATE_API_TOKEN: {
      exists: !!replicateKey,
      length: replicateKey?.length || 0,
    },
    timestamp: new Date().toISOString(),
  })
}
