/**
 * POST /api/admin/users/[userId]/regenerate
 * Trigger regeneration for a user's avatar
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'
import { hasPermission } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    if (!hasPermission(session.role as 'super_admin' | 'admin' | 'viewer', 'users.regenerate')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId } = await context.params
    const userIdNum = parseInt(userId, 10)

    if (isNaN(userIdNum)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const body = await request.json()
    const { avatarId, styleId, photoCount } = body

    if (!avatarId) {
      return NextResponse.json({ error: 'avatarId is required' }, { status: 400 })
    }

    const sql = getSql()

    // Check if user and avatar exist
    const [avatar] = await sql`
      SELECT a.id, a.user_id, u.telegram_user_id, u.is_pro
      FROM avatars a
      JOIN users u ON u.id = a.user_id
      WHERE a.id = ${avatarId} AND a.user_id = ${userIdNum}
    `

    if (!avatar) {
      return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })
    }

    // Create a new generation job
    const [job] = await sql`
      INSERT INTO generation_jobs (
        avatar_id,
        style_id,
        status,
        total_photos,
        completed_photos,
        created_at,
        updated_at
      ) VALUES (
        ${avatarId},
        ${styleId || 'professional'},
        'pending',
        ${photoCount || 15},
        0,
        NOW(),
        NOW()
      )
      RETURNING id
    `

    // Update avatar status
    await sql`
      UPDATE avatars
      SET status = 'processing', updated_at = NOW()
      WHERE id = ${avatarId}
    `

    // Audit log
    await logAdminAction({
      adminId: session.adminId,
      action: 'generation_triggered',
      targetType: 'avatar',
      targetId: parseInt(avatarId),
      metadata: {
        userId: userIdNum,
        jobId: job.id,
        styleId: styleId || 'professional',
        photoCount: photoCount || 15,
        telegramUserId: avatar.telegram_user_id?.toString()
      }
    })

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Generation job created'
    })
  } catch (error) {
    console.error('[Admin User Regenerate] Error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger regeneration' },
      { status: 500 }
    )
  }
}
