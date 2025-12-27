// Debug endpoint to check task status

import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get("jobId")

  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 })
  }

  try {
    // Get job status
    const job = await sql`
      SELECT * FROM generation_jobs WHERE id = ${jobId}
    `.then((rows: any[]) => rows[0])

    // Get kie_tasks
    const tasks = await sql`
      SELECT * FROM kie_tasks WHERE job_id = ${jobId}
    `

    // Get generated photos
    const photos = await sql`
      SELECT id, image_url FROM generated_photos
      WHERE avatar_id = ${job?.avatar_id} AND style_id = ${job?.style_id}
    `

    return NextResponse.json({
      job,
      tasks,
      photosGenerated: photos.length,
      photos: photos.slice(0, 3).map((p: any) => ({
        id: p.id,
        url: p.image_url?.substring(0, 100) + "...",
      })),
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
