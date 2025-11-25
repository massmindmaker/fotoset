import { type NextRequest, NextResponse } from "next/server"
import { PHOTOSET_PROMPTS } from "@/lib/prompts"

export async function POST(request: NextRequest) {
  try {
    const { styleId, referenceImages, deviceId } = await request.json()

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID required" }, { status: 400 })
    }

    // В демо-режиме возвращаем placeholder URLs
    const generatedImages = PHOTOSET_PROMPTS.map((prompt, index) => ({
      id: index + 1,
      prompt: prompt.substring(0, 100) + "...",
      url: `/placeholder.svg?height=512&width=512&query=${encodeURIComponent(`AI portrait photo ${index + 1} ${styleId}`)}`,
      status: "done",
    }))

    return NextResponse.json({
      success: true,
      images: generatedImages,
      total: 23,
    })
  } catch (error) {
    console.error("Batch generation error:", error)
    return NextResponse.json({ error: "Generation failed" }, { status: 500 })
  }
}
