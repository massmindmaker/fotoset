// Temporary endpoint to reset stuck generation jobs
import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const parsedJobId = parseInt(id)
  
  if (isNaN(parsedJobId)) {
    return NextResponse.json({ error: "Invalid jobId" }, { status: 400 })
  }

  // Reset job to pending and clear error
  const result = await sql`
    UPDATE generation_jobs
    SET status = 'pending', error_message = NULL, updated_at = NOW()
    WHERE id = ${parsedJobId}
    RETURNING id, status, avatar_id
  `

  if (result.length === 0) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    job: result[0],
    message: "Job reset to pending. Trigger generation again to restart."
  })
}
