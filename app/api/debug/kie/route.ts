// Diagnostic endpoint to test Kie.ai API with reference images
// DELETE AFTER DEBUGGING

import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const maxDuration = 60

const KIE_API_URL = "https://api.kie.ai/api/v1/jobs/createTask"
const KIE_STATUS_URL = "https://api.kie.ai/api/v1/jobs/recordInfo"

export async function GET() {
  const apiKey = (process.env.KIE_AI_API_KEY || process.env.KIE_API_KEY)?.trim()

  // Get reference images from avatar 9
  const refs = await sql`
    SELECT image_url FROM reference_photos
    WHERE avatar_id = 9
    LIMIT 4
  `

  const referenceImages = refs.map((r: { image_url: string }) => r.image_url)

  console.log("[Debug/Kie] Reference images:", referenceImages.length)

  // Test with reference images (like real generation)
  let createTaskResult: unknown = null
  const statusChecks: unknown[] = []

  try {
    const input: Record<string, unknown> = {
      prompt: "A professional headshot portrait of this person, studio lighting, neutral background",
      output_format: "jpg",
      image_size: "3:4",
    }

    // Add reference images
    if (referenceImages.length > 0) {
      input.image_input = referenceImages
    }

    const response = await fetch(KIE_API_URL, {
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

    const responseText = await response.text()
    console.log(`[Debug/Kie] Create task response: ${response.status}`)

    createTaskResult = {
      status: response.status,
      ok: response.ok,
      body: responseText.substring(0, 300),
    }

    // If task created, poll for result (30 seconds with 5s intervals)
    if (response.ok) {
      const createData = JSON.parse(responseText)
      const taskId = createData.data?.taskId

      if (taskId) {
        // Poll for up to 50 seconds
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 5000))

          const statusResponse = await fetch(`${KIE_STATUS_URL}?taskId=${taskId}`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
            },
          })

          const statusText = await statusResponse.text()
          const statusData = JSON.parse(statusText)
          const state = statusData.data?.state

          console.log(`[Debug/Kie] Status check ${i + 1}: ${state}`)

          statusChecks.push({
            check: i + 1,
            state,
            hasResultJson: !!statusData.data?.resultJson,
          })

          // If completed or failed, break
          if (state === "success" || state === "SUCCESS" || state === "failed" || state === "FAILED") {
            if (statusData.data?.resultJson) {
              try {
                const resultJson = typeof statusData.data.resultJson === "string"
                  ? JSON.parse(statusData.data.resultJson)
                  : statusData.data.resultJson
                statusChecks.push({
                  final: true,
                  resultUrls: resultJson.resultUrls,
                })
              } catch {
                statusChecks.push({ final: true, parseError: true })
              }
            }
            break
          }
        }
      }
    }
  } catch (error) {
    createTaskResult = {
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    referenceImagesCount: referenceImages.length,
    createTaskTest: createTaskResult,
    statusChecks,
  })
}
