/**
 * GET /api/admin/generations/[id]
 * Get detailed generation job information
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'
import type { GenerationDetails } from '@/lib/admin/types'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const jobId = parseInt(id, 10)

    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 })
    }

    const sql = getSql()

    // Get job details
    const [job] = await sql`
      SELECT
        gj.id,
        gj.avatar_id,
        a.name as avatar_name,
        gj.style_id,
        gj.status,
        gj.total_photos,
        gj.completed_photos,
        gj.error_message,
        gj.payment_id,
        gj.created_at,
        gj.updated_at,
        u.id as user_id,
        u.telegram_user_id,
        CASE
          WHEN gj.total_photos > 0 THEN ROUND((gj.completed_photos::numeric / gj.total_photos::numeric) * 100)
          ELSE 0
        END as progress,
        CASE
          WHEN gj.status IN ('completed', 'failed') AND gj.updated_at > gj.created_at
          THEN EXTRACT(EPOCH FROM (gj.updated_at - gj.created_at))::int
          ELSE NULL
        END as duration
      FROM generation_jobs gj
      LEFT JOIN avatars a ON a.id = gj.avatar_id
      LEFT JOIN users u ON u.id = a.user_id
      WHERE gj.id = ${jobId}
    `

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Get generated photos
    const photos = await sql`
      SELECT
        id,
        style_id,
        prompt,
        image_url,
        created_at
      FROM generated_photos
      WHERE avatar_id = ${job.avatar_id}
      ORDER BY created_at DESC
    `

    // Get KIE tasks (if exists)
    let kie_tasks: Record<string, unknown>[] = []
    try {
      kie_tasks = await sql`
        SELECT
          id,
          job_id,
          style_id,
          status,
          task_id,
          image_url,
          error_message,
          created_at,
          updated_at
        FROM kie_tasks
        WHERE job_id = ${jobId}
        ORDER BY created_at DESC
      `
    } catch {
      // Table might not exist
      kie_tasks = []
    }

    // Get avatar info with reference photos count
    let avatar = null
    if (job.avatar_id) {
      const [avatarData] = await sql`
        SELECT
          a.id,
          a.name,
          a.status,
          (SELECT COUNT(*) FROM reference_photos WHERE avatar_id = a.id)::int as reference_photos_count
        FROM avatars a
        WHERE a.id = ${job.avatar_id}
      `
      if (avatarData) {
        avatar = {
          id: avatarData.id,
          name: avatarData.name || `Avatar #${avatarData.id}`,
          status: avatarData.status,
          reference_photos_count: avatarData.reference_photos_count || 0
        }
      }
    }

    const details: GenerationDetails = {
      id: job.id,
      avatar_id: job.avatar_id,
      avatar_name: job.avatar_name,
      style_id: job.style_id,
      status: job.status,
      total_photos: job.total_photos,
      completed_photos: job.completed_photos,
      error_message: job.error_message,
      payment_id: job.payment_id,
      created_at: job.created_at,
      updated_at: job.updated_at,
      user_id: job.user_id,
      telegram_user_id: job.telegram_user_id,
      progress: parseInt(String(job.progress || 0), 10),
      duration: job.duration,
      photos: photos.map((p: Record<string, unknown>) => ({
        id: p.id as number,
        style_id: p.style_id as string | null,
        prompt: p.prompt as string | null,
        image_url: p.image_url as string,
        created_at: p.created_at as string
      })),
      kie_tasks: kie_tasks.map((t: Record<string, unknown>) => ({
        id: t.id as number,
        job_id: t.job_id as number,
        style_id: t.style_id as string | null,
        status: t.status as string,
        task_id: t.task_id as string | null,
        image_url: t.image_url as string | null,
        error_message: t.error_message as string | null,
        created_at: t.created_at as string,
        updated_at: t.updated_at as string
      })),
      avatar
    }

    return NextResponse.json({ job: details })
  } catch (error) {
    console.error('[Admin Generation Details] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch generation details' },
      { status: 500 }
    )
  }
}
