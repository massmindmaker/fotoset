import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getDeviceId, verifyResourceOwnership } from "@/lib/auth-utils"

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/jobs/:id - Get job status with generated photos
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const jobId = parseInt(id, 10)

  if (isNaN(jobId)) {
    return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })
  }

  // SECURITY: Verify ownership before returning job data
  const deviceId = getDeviceId(request)
  const ownership = await verifyResourceOwnership(deviceId, "job", jobId)

  if (!ownership.resourceExists) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  if (!ownership.authorized) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  try {
    // Get job details
    const jobResult = await query(
      `SELECT
        j.id,
        j.avatar_id,
        j.style_id,
        j.status,
        j.total_photos,
        j.completed_photos,
        j.error_message,
        j.created_at,
        j.updated_at
      FROM generation_jobs j
      WHERE j.id = $1`,
      [jobId]
    )

    const job = jobResult.rows[0]

    // Get generated photos for this job (by avatar_id and style_id after job creation)
    const photosResult = await query(
      `SELECT id, style_id, prompt, image_url, created_at
       FROM generated_photos
       WHERE avatar_id = $1 AND created_at >= $2
       ORDER BY created_at ASC`,
      [job.avatar_id, job.created_at]
    )

    const photos = photosResult.rows.map((row) => ({
      id: row.id,
      styleId: row.style_id,
      prompt: row.prompt,
      imageUrl: row.image_url,
      createdAt: row.created_at,
    }))

    return NextResponse.json({
      id: job.id,
      avatarId: job.avatar_id,
      styleId: job.style_id,
      status: job.status,
      totalPhotos: job.total_photos,
      completedPhotos: job.completed_photos,
      errorMessage: job.error_message,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      photos,
    })
  } catch (error) {
    console.error("[API] GET /api/jobs/:id error:", error)
    return NextResponse.json(
      { error: "Failed to fetch job status" },
      { status: 500 }
    )
  }
}
