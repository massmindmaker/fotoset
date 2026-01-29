/**
 * GET /api/admin/packs/[id]
 * Get full pack details with all prompts
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60


import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(
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
    // Get pack details
    const packResult = await sql`
      SELECT
        p.id,
        p.admin_id,
        p.name,
        p.description,
        p.cover_url,
        p.preview_images,
        p.icon_emoji,
        p.slug,
        p.owner_type,
        p.partner_user_id,
        p.moderation_status,
        p.submitted_at,
        p.reviewed_by,
        p.reviewed_at,
        p.rejection_reason,
        p.is_active,
        p.is_featured,
        p.sort_order,
        p.usage_count,
        p.created_at,
        p.updated_at,
        u.telegram_username as partner_username,
        u.telegram_user_id as partner_telegram_id,
        u.email as partner_email,
        u.name as partner_name,
        rb.is_partner,
        rb.commission_rate,
        rb.referrals_count,
        rb.total_earned,
        au.email as admin_email,
        reviewer.email as reviewed_by_email
      FROM photo_packs p
      LEFT JOIN users u ON p.partner_user_id = u.id
      LEFT JOIN referral_balances rb ON rb.user_id = p.partner_user_id
      LEFT JOIN admin_users au ON au.id = p.admin_id
      LEFT JOIN admin_users reviewer ON reviewer.id = p.reviewed_by
      WHERE p.id = ${packId}
    `

    if (packResult.length === 0) {
      return NextResponse.json(
        { error: 'Pack not found' },
        { status: 404 }
      )
    }

    const pack = packResult[0]

    // Get all prompts for this pack
    const prompts = await sql`
      SELECT
        id,
        pack_id,
        prompt,
        negative_prompt,
        style_prefix,
        style_suffix,
        preview_url,
        position,
        is_active,
        created_at
      FROM pack_prompts
      WHERE pack_id = ${packId}
      ORDER BY position ASC, id ASC
    `

    // Get usage stats
    const stats = await sql`
      SELECT
        COUNT(DISTINCT gj.id) as total_generations,
        COUNT(DISTINCT gj.avatar_id) as unique_users
      FROM generation_jobs gj
      WHERE gj.pack_id = ${packId}
    `

    return NextResponse.json({
      success: true,
      pack: {
        id: pack.id,
        adminId: pack.admin_id,
        name: pack.name,
        description: pack.description,
        coverUrl: pack.cover_url,
        previewImages: pack.preview_images || [],
        iconEmoji: pack.icon_emoji,
        slug: pack.slug,
        ownerType: pack.owner_type,
        partnerUserId: pack.partner_user_id,
        partnerUsername: pack.partner_username,
        partnerTelegramId: pack.partner_telegram_id,
        partnerEmail: pack.partner_email,
        partnerName: pack.partner_name,
        isPartner: pack.is_partner || false,
        commissionRate: Number(pack.commission_rate || 0.10),
        referralsCount: pack.referrals_count || 0,
        totalEarned: Number(pack.total_earned || 0),
        moderationStatus: pack.moderation_status,
        submittedAt: pack.submitted_at,
        reviewedBy: pack.reviewed_by,
        reviewedByEmail: pack.reviewed_by_email,
        reviewedAt: pack.reviewed_at,
        rejectionReason: pack.rejection_reason,
        isActive: pack.is_active,
        isFeatured: pack.is_featured,
        sortOrder: pack.sort_order,
        usageCount: pack.usage_count || 0,
        adminEmail: pack.admin_email,
        createdAt: pack.created_at,
        updatedAt: pack.updated_at,
      },
      prompts: prompts.map((prompt: any) => ({
        id: prompt.id,
        packId: prompt.pack_id,
        prompt: prompt.prompt,
        negativePrompt: prompt.negative_prompt,
        stylePrefix: prompt.style_prefix,
        styleSuffix: prompt.style_suffix,
        previewUrl: prompt.preview_url,
        position: prompt.position,
        isActive: prompt.is_active,
        createdAt: prompt.created_at,
      })),
      stats: {
        totalGenerations: parseInt(stats[0]?.total_generations || '0', 10),
        uniqueUsers: parseInt(stats[0]?.unique_users || '0', 10),
        promptCount: prompts.length,
      },
    })
  } catch (error) {
    console.error('[Admin Pack Detail] GET Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pack details' },
      { status: 500 }
    )
  }
}
