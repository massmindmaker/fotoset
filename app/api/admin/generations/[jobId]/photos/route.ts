/**
 * GET /api/admin/generations/[jobId]/photos
 * Get photos for a specific generation job
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { jobId } = await context.params
    const jobIdNum = parseInt(jobId, 10)

    if (isNaN(jobIdNum)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 })
    }

    const sql = getSql()

    // Get photos for this job via avatar_id
    const photos = await sql`
      SELECT
        gp.id,
        gp.image_url,
        gp.prompt_index,
        gp.style_id,
        gp.created_at
      FROM generated_photos gp
      JOIN generation_jobs gj ON gj.avatar_id = gp.avatar_id
      WHERE gj.id = ${jobIdNum}
        AND gp.image_url IS NOT NULL
      ORDER BY gp.prompt_index ASC
    `

    return NextResponse.json({ photos })
  } catch (error) {
    console.error('[Admin Generation Photos] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    )
  }
}
