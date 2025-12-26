// Diagnostic endpoint to test Kie.ai API connection
// DELETE AFTER DEBUGGING

import { NextResponse } from "next/server"

export const maxDuration = 60

const KIE_API_URL = "https://api.kie.ai/api/v1/jobs/createTask"

export async function GET() {
  const kieAiKey = process.env.KIE_AI_API_KEY?.trim()
  const kieKey = process.env.KIE_API_KEY?.trim()
  const apiKey = kieAiKey || kieKey

  const envCheck = {
    KIE_AI_API_KEY: kieAiKey ? `SET (${kieAiKey.length} chars, starts: ${kieAiKey.substring(0, 8)}...)` : "NOT SET",
    KIE_API_KEY: kieKey ? `SET (${kieKey.length} chars, starts: ${kieKey.substring(0, 8)}...)` : "NOT SET",
    VERCEL_ENV: process.env.VERCEL_ENV,
  }

  console.log("[Debug/Kie] ENV Check:", JSON.stringify(envCheck))

  // Test actual generation endpoint
  let createTaskResult: unknown = null
  try {
    const response = await fetch(KIE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nano-banana-pro",
        input: {
          prompt: "A simple test portrait of a person, 1:1 ratio, minimal",
          output_format: "jpg",
          image_size: "1:1",
        },
      }),
    })

    const responseText = await response.text()
    console.log(`[Debug/Kie] Create task response: ${response.status} - ${responseText.substring(0, 500)}`)

    createTaskResult = {
      status: response.status,
      ok: response.ok,
      body: responseText.substring(0, 500),
    }
  } catch (error) {
    createTaskResult = {
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env: envCheck,
    createTaskTest: createTaskResult,
  })
}
