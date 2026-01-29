/**
 * POST /api/admin/generations/[id]/retry
 * Retry a failed generation job
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
import { logAdminAction } from '@/lib/admin/audit'
export async function POST(
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
    // Get current job
    const [job] = await sql`
      SELECT
        gj.id,
        gj.avatar_id,
        gj.style_id,
        gj.status,
        gj.total_photos,
        a.user_id
      FROM generation_jobs gj
      LEFT JOIN avatars a ON a.id = gj.avatar_id
      WHERE gj.id = ${jobId}
    `

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Only allow retry for failed or cancelled jobs
    if (!['failed', 'cancelled'].includes(job.status)) {
      return NextResponse.json(
        { error: `Cannot retry job with status: ${job.status}` },
        { status: 400 }
      )
    }

    // Reset job to pending
    const [updatedJob] = await sql`
      UPDATE generation_jobs
      SET
        status = 'pending',
        completed_photos = 0,
        error_message = NULL,
        updated_at = NOW()
      WHERE id = ${jobId}
      RETURNING *
    `

    // Log admin action
    await logAdminAction({
      adminId: session.adminId,
      action: 'generation_retried',
      targetType: 'generation',
      targetId: jobId,
      metadata: {
        previous_status: job.status,
        avatar_id: job.avatar_id,
        style_id: job.style_id,
        action: 'retry'
      }
    })

    // Trigger the generation process
    // The job will be picked up by the cron job or we can call the generate API
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      await fetch(`${appUrl}/api/jobs/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      })
    } catch (triggerError) {
      console.warn('[Admin Retry] Failed to trigger immediate processing:', triggerError)
      // Job will be picked up by cron anyway
    }

    return NextResponse.json({
      success: true,
      job: {
        id: updatedJob.id,
        status: updatedJob.status,
        message: 'Generation job queued for retry'
      }
    })
  } catch (error) {
    console.error('[Admin Generation Retry] Error:', error)
    return NextResponse.json(
      { error: 'Failed to retry generation' },
      { status: 500 }
    )
  }
}
