/**
 * POST /api/admin/packs/[id]/review
 * Approve or reject a partner-submitted pack
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const packId = parseInt(id, 10)

    if (isNaN(packId)) {
      return NextResponse.json(
        { error: 'Invalid pack ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { action, reason } = body

    // Validate action
    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    // Require reason for rejection
    if (action === 'reject' && !reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      )
    }
    // Check pack exists and is eligible for review
    const packCheck = await sql`
      SELECT
        id,
        name,
        owner_type,
        partner_user_id,
        moderation_status
      FROM photo_packs
      WHERE id = ${packId}
    `

    if (packCheck.length === 0) {
      return NextResponse.json(
        { error: 'Pack not found' },
        { status: 404 }
      )
    }

    const pack = packCheck[0]

    // Only partner packs can be reviewed
    if (pack.owner_type !== 'partner') {
      return NextResponse.json(
        { error: 'Only partner packs can be reviewed' },
        { status: 400 }
      )
    }

    // Check if pack is in reviewable state
    if (!['pending', 'draft'].includes(pack.moderation_status)) {
      return NextResponse.json(
        { error: `Pack is already ${pack.moderation_status}` },
        { status: 400 }
      )
    }

    // Perform the review action
    const now = new Date().toISOString()

    if (action === 'approve') {
      // Approve: set status to approved, activate pack
      const result = await sql`
        UPDATE photo_packs
        SET
          moderation_status = 'approved',
          reviewed_by = ${session.adminId},
          reviewed_at = ${now},
          is_active = TRUE,
          rejection_reason = NULL
        WHERE id = ${packId}
        RETURNING *
      `

      console.log(`[Admin Pack Review] Pack ${packId} "${pack.name}" approved by admin ${session.email}`)

      return NextResponse.json({
        success: true,
        message: 'Pack approved successfully',
        pack: {
          id: result[0].id,
          name: result[0].name,
          moderationStatus: result[0].moderation_status,
          reviewedBy: session.adminId,
          reviewedByEmail: session.email,
          reviewedAt: result[0].reviewed_at,
          isActive: result[0].is_active,
        },
      })
    } else {
      // Reject: set status to rejected, deactivate pack
      const result = await sql`
        UPDATE photo_packs
        SET
          moderation_status = 'rejected',
          reviewed_by = ${session.adminId},
          reviewed_at = ${now},
          is_active = FALSE,
          rejection_reason = ${reason}
        WHERE id = ${packId}
        RETURNING *
      `

      console.log(`[Admin Pack Review] Pack ${packId} "${pack.name}" rejected by admin ${session.email}: ${reason}`)

      return NextResponse.json({
        success: true,
        message: 'Pack rejected',
        pack: {
          id: result[0].id,
          name: result[0].name,
          moderationStatus: result[0].moderation_status,
          reviewedBy: session.adminId,
          reviewedByEmail: session.email,
          reviewedAt: result[0].reviewed_at,
          isActive: result[0].is_active,
          rejectionReason: result[0].rejection_reason,
        },
      })
    }
  } catch (error) {
    console.error('[Admin Pack Review] POST Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to review pack' },
      { status: 500 }
    )
  }
}
