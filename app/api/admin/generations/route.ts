/**
 * GET /api/admin/generations
 * List generation jobs with filters and stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
import { getCurrentMode } from '@/lib/admin/mode'
import type { AdminGenerationJob, GenerationStats } from '@/lib/admin/types'
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const userId = searchParams.get('userId') || ''
    const avatarId = searchParams.get('avatarId') || ''
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = (page - 1) * limit
    // Parse filters
    const statusFilter = status || null
    const dateFromFilter = dateFrom || null
    const dateToFilter = dateTo || null
    const userIdFilter = userId ? parseInt(userId, 10) : null
    const avatarIdFilter = avatarId ? parseInt(avatarId, 10) : null

    // Get current mode (test vs production)
    const mode = await getCurrentMode()
    const isTestMode = mode === 'test'

    // Get total count with filters
    const [countResult] = await sql`
      SELECT COUNT(*) as count
      FROM generation_jobs gj
      LEFT JOIN avatars a ON a.id = gj.avatar_id
      LEFT JOIN users u ON u.id = a.user_id
      WHERE
        COALESCE(gj.is_test_mode, false) = ${isTestMode}
        AND (${statusFilter}::text IS NULL OR gj.status = ${statusFilter})
        AND (${dateFromFilter}::date IS NULL OR gj.created_at >= ${dateFromFilter}::date)
        AND (${dateToFilter}::date IS NULL OR gj.created_at <= ${dateToFilter}::date + interval '1 day')
        AND (${userIdFilter}::int IS NULL OR u.id = ${userIdFilter})
        AND (${avatarIdFilter}::int IS NULL OR gj.avatar_id = ${avatarIdFilter})
    `
    const total = parseInt(String(countResult?.count || 0), 10)

    // Get jobs with pagination
    const jobs = await sql`
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
      WHERE
        COALESCE(gj.is_test_mode, false) = ${isTestMode}
        AND (${statusFilter}::text IS NULL OR gj.status = ${statusFilter})
        AND (${dateFromFilter}::date IS NULL OR gj.created_at >= ${dateFromFilter}::date)
        AND (${dateToFilter}::date IS NULL OR gj.created_at <= ${dateToFilter}::date + interval '1 day')
        AND (${userIdFilter}::int IS NULL OR u.id = ${userIdFilter})
        AND (${avatarIdFilter}::int IS NULL OR gj.avatar_id = ${avatarIdFilter})
      ORDER BY gj.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    // Get stats (filtered by mode)
    const [statsResult] = await sql`
      SELECT
        COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_jobs,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_jobs,
        SUM(completed_photos) as total_photos,
        AVG(
          CASE
            WHEN status = 'completed' AND updated_at > created_at
            THEN EXTRACT(EPOCH FROM (updated_at - created_at))
            ELSE NULL
          END
        ) as avg_completion_time
      FROM generation_jobs
      WHERE COALESCE(is_test_mode, false) = ${isTestMode}
    `

    const totalJobs = parseInt(String(statsResult?.total_jobs || 0), 10)
    const completedJobs = parseInt(String(statsResult?.completed_jobs || 0), 10)

    const stats: GenerationStats = {
      total_jobs: totalJobs,
      completed_jobs: completedJobs,
      failed_jobs: parseInt(String(statsResult?.failed_jobs || 0), 10),
      processing_jobs: parseInt(String(statsResult?.processing_jobs || 0), 10),
      pending_jobs: parseInt(String(statsResult?.pending_jobs || 0), 10),
      total_photos: parseInt(String(statsResult?.total_photos || 0), 10),
      avg_completion_time: Math.round(parseFloat(String(statsResult?.avg_completion_time || 0))),
      success_rate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0
    }

    // Transform jobs to match AdminGenerationJob type
    const formattedJobs: AdminGenerationJob[] = jobs.map((job) => ({
      id: job.id as number,
      avatar_id: job.avatar_id as number,
      avatar_name: job.avatar_name as string | null,
      style_id: job.style_id as string | null,
      status: job.status as AdminGenerationJob['status'],
      total_photos: job.total_photos as number,
      completed_photos: job.completed_photos as number,
      error_message: job.error_message as string | null,
      payment_id: job.payment_id as number | null,
      created_at: job.created_at as string,
      updated_at: job.updated_at as string,
      user_id: job.user_id as number,
      telegram_user_id: job.telegram_user_id as number,
      progress: parseInt(String(job.progress || 0), 10),
      duration: job.duration as number | null
    }))

    return NextResponse.json({
      jobs: formattedJobs,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('[Admin Generations] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch generations' },
      { status: 500 }
    )
  }
}
