// Direct Kie.ai test from QStash-like environment
// Tests the same code path as jobs/process

import { NextResponse } from "next/server"
import { generateImage } from "@/lib/imagen"
import { sql } from "@/lib/db"

export const maxDuration = 300

export async function GET() {
  const startTime = Date.now()

  try {
    // Get reference images like jobs/process does
    const refs = await sql`
      SELECT image_url FROM reference_photos
      WHERE avatar_id = 9
      LIMIT 4
    `

    const referenceImages = refs.map((r: { image_url: string }) => r.image_url)

    console.log("[Debug/Kie-Direct] Starting generation with", referenceImages.length, "refs")

    // Call the same function as jobs/process
    const imageUrl = await generateImage({
      prompt: "A professional headshot portrait of this person, studio lighting, neutral background",
      referenceImages: referenceImages.slice(0, 4),
      aspectRatio: "3:4",
      resolution: "1K",
    })

    const elapsed = Date.now() - startTime

    return NextResponse.json({
      success: true,
      imageUrl: imageUrl.substring(0, 100) + "...",
      elapsedMs: elapsed,
      referenceCount: referenceImages.length,
    })
  } catch (error) {
    const elapsed = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : "Unknown error"

    console.error("[Debug/Kie-Direct] Error:", errorMsg)

    return NextResponse.json({
      success: false,
      error: errorMsg,
      elapsedMs: elapsed,
    })
  }
}
