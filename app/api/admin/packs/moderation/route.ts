/**
 * GET /api/admin/packs/moderation
 * List packs awaiting moderation (pending) or all packs by status
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60


import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const offset = (page - 1) * limit
    // Get total count
    const countResult = status === 'all'
      ? await sql`SELECT COUNT(*) as total FROM photo_packs WHERE owner_type = 'partner'`
      : await sql`
          SELECT COUNT(*) as total
          FROM photo_packs
          WHERE owner_type = 'partner' AND moderation_status = ${status}
        `
    const total = parseInt(countResult[0]?.total || '0', 10)

    // Get packs with partner info and prompt count
    const packs = status === 'all'
      ? await sql`
          SELECT
            p.id,
            p.name,
            p.description,
            p.cover_url,
            p.preview_images,
            p.icon_emoji,
            p.slug,
            p.partner_user_id,
            p.moderation_status,
            p.submitted_at,
            p.reviewed_by,
            p.reviewed_at,
            p.rejection_reason,
            p.is_active,
            p.is_featured,
            p.usage_count,
            p.created_at,
            p.updated_at,
            u.telegram_username as partner_username,
            u.telegram_user_id as partner_telegram_id,
            u.email as partner_email,
            u.name as partner_name,
            rb.is_partner,
            rb.commission_rate,
            au.email as reviewed_by_email,
            (SELECT COUNT(*) FROM pack_prompts WHERE pack_id = p.id) as prompt_count
          FROM photo_packs p
          LEFT JOIN users u ON p.partner_user_id = u.id
          LEFT JOIN referral_balances rb ON rb.user_id = p.partner_user_id
          LEFT JOIN admin_users au ON au.id = p.reviewed_by
          WHERE p.owner_type = 'partner'
          ORDER BY
            CASE p.moderation_status
              WHEN 'pending' THEN 1
              WHEN 'approved' THEN 2
              WHEN 'rejected' THEN 3
              WHEN 'draft' THEN 4
            END,
            p.submitted_at DESC,
            p.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `
      : await sql`
          SELECT
            p.id,
            p.name,
            p.description,
            p.cover_url,
            p.preview_images,
            p.icon_emoji,
            p.slug,
            p.partner_user_id,
            p.moderation_status,
            p.submitted_at,
            p.reviewed_by,
            p.reviewed_at,
            p.rejection_reason,
            p.is_active,
            p.is_featured,
            p.usage_count,
            p.created_at,
            p.updated_at,
            u.telegram_username as partner_username,
            u.telegram_user_id as partner_telegram_id,
            u.email as partner_email,
            u.name as partner_name,
            rb.is_partner,
            rb.commission_rate,
            au.email as reviewed_by_email,
            (SELECT COUNT(*) FROM pack_prompts WHERE pack_id = p.id) as prompt_count
          FROM photo_packs p
          LEFT JOIN users u ON p.partner_user_id = u.id
          LEFT JOIN referral_balances rb ON rb.user_id = p.partner_user_id
          LEFT JOIN admin_users au ON au.id = p.reviewed_by
          WHERE p.owner_type = 'partner' AND p.moderation_status = ${status}
          ORDER BY p.submitted_at ASC, p.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `

    // Get counts by status
    const counts = await sql`
      SELECT
        COUNT(*) FILTER (WHERE moderation_status = 'draft') as draft,
        COUNT(*) FILTER (WHERE moderation_status = 'pending') as pending,
        COUNT(*) FILTER (WHERE moderation_status = 'approved') as approved,
        COUNT(*) FILTER (WHERE moderation_status = 'rejected') as rejected,
        COUNT(*) as total
      FROM photo_packs
      WHERE owner_type = 'partner'
    `

    return NextResponse.json({
      success: true,
      packs: packs.map((pack: any) => ({
        id: pack.id,
        name: pack.name,
        description: pack.description,
        coverUrl: pack.cover_url,
        previewImages: pack.preview_images || [],
        iconEmoji: pack.icon_emoji,
        slug: pack.slug,
        partnerUserId: pack.partner_user_id,
        partnerUsername: pack.partner_username,
        partnerTelegramId: pack.partner_telegram_id,
        partnerEmail: pack.partner_email,
        partnerName: pack.partner_name,
        isPartner: pack.is_partner || false,
        commissionRate: Number(pack.commission_rate || 0.10),
        moderationStatus: pack.moderation_status,
        submittedAt: pack.submitted_at,
        reviewedBy: pack.reviewed_by,
        reviewedByEmail: pack.reviewed_by_email,
        reviewedAt: pack.reviewed_at,
        rejectionReason: pack.rejection_reason,
        isActive: pack.is_active,
        isFeatured: pack.is_featured,
        usageCount: pack.usage_count || 0,
        promptCount: parseInt(pack.prompt_count || '0', 10),
        createdAt: pack.created_at,
        updatedAt: pack.updated_at,
      })),
      counts: {
        draft: parseInt(counts[0].draft || '0', 10),
        pending: parseInt(counts[0].pending || '0', 10),
        approved: parseInt(counts[0].approved || '0', 10),
        rejected: parseInt(counts[0].rejected || '0', 10),
        total: parseInt(counts[0].total || '0', 10),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[Admin Packs Moderation] GET Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch packs for moderation' },
      { status: 500 }
    )
  }
}
