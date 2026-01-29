export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

/**
 * GET /api/admin/partners
 * List partner applications and active partners
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || "all"
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const offset = (page - 1) * limit

    // Build status filter
    const statusFilter = status === "all"
      ? sql``
      : sql`AND pa.status = ${status}`

    // Get applications with user info
    const applications = await sql`
      SELECT
        pa.id,
        pa.user_id,
        pa.contact_name,
        pa.contact_email,
        pa.contact_phone,
        pa.telegram_username,
        pa.audience_size,
        pa.audience_type,
        pa.promotion_channels,
        pa.website_url,
        pa.social_links,
        pa.message,
        pa.expected_referrals,
        pa.status,
        pa.rejection_reason,
        pa.reviewed_by,
        pa.reviewed_at,
        pa.admin_notes,
        pa.created_at,
        u.telegram_user_id,
        rb.referrals_count,
        rb.total_earned,
        rb.balance,
        rb.commission_rate,
        rb.is_partner
      FROM partner_applications pa
      JOIN users u ON u.id = pa.user_id
      LEFT JOIN referral_balances rb ON rb.user_id = pa.user_id
      WHERE 1=1 ${statusFilter}
      ORDER BY
        CASE pa.status
          WHEN 'pending' THEN 1
          WHEN 'approved' THEN 2
          WHEN 'rejected' THEN 3
        END,
        pa.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `

    // Get counts by status
    const counts = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) as total
      FROM partner_applications
    `

    // Get active partners (approved with 50% rate)
    const activePartners = await sql`
      SELECT
        u.id as user_id,
        u.telegram_user_id,
        u.telegram_username,
        rb.referrals_count,
        rb.total_earned,
        rb.balance,
        rb.commission_rate,
        rb.partner_approved_at
      FROM referral_balances rb
      JOIN users u ON u.id = rb.user_id
      WHERE rb.is_partner = TRUE
      ORDER BY rb.total_earned DESC
      LIMIT 50
    `

    // Stats
    const stats = await sql`
      SELECT
        COUNT(*) FILTER (WHERE rb.is_partner = TRUE) as total_partners,
        COALESCE(SUM(rb.total_earned) FILTER (WHERE rb.is_partner = TRUE), 0) as partner_earnings,
        COALESCE(SUM(rb.referrals_count) FILTER (WHERE rb.is_partner = TRUE), 0) as partner_referrals
      FROM referral_balances rb
    `

    return NextResponse.json({
      success: true,
      applications: applications.map((app: any) => ({
        id: app.id,
        userId: app.user_id,
        telegramUserId: app.telegram_user_id,
        contactName: app.contact_name,
        contactEmail: app.contact_email,
        contactPhone: app.contact_phone,
        telegramUsername: app.telegram_username,
        audienceSize: app.audience_size,
        audienceType: app.audience_type,
        promotionChannels: app.promotion_channels,
        websiteUrl: app.website_url,
        socialLinks: app.social_links ? JSON.parse(app.social_links) : null,
        message: app.message,
        expectedReferrals: app.expected_referrals,
        status: app.status,
        rejectionReason: app.rejection_reason,
        reviewedBy: app.reviewed_by,
        reviewedAt: app.reviewed_at,
        adminNotes: app.admin_notes,
        createdAt: app.created_at,
        // Current stats
        referralsCount: app.referrals_count || 0,
        totalEarned: Number(app.total_earned || 0),
        balance: Number(app.balance || 0),
        commissionRate: Number(app.commission_rate || 0.10),
        isPartner: app.is_partner || false,
      })),
      activePartners: activePartners.map((p: any) => ({
        userId: p.user_id,
        telegramUserId: p.telegram_user_id,
        telegramUsername: p.telegram_username,
        referralsCount: p.referrals_count || 0,
        totalEarned: Number(p.total_earned || 0),
        balance: Number(p.balance || 0),
        commissionRate: Number(p.commission_rate),
        partnerApprovedAt: p.partner_approved_at,
      })),
      counts: {
        pending: parseInt(counts[0].pending),
        approved: parseInt(counts[0].approved),
        rejected: parseInt(counts[0].rejected),
        total: parseInt(counts[0].total),
      },
      stats: {
        totalPartners: parseInt(stats[0].total_partners),
        partnerEarnings: Number(stats[0].partner_earnings),
        partnerReferrals: parseInt(stats[0].partner_referrals),
      },
      pagination: {
        page,
        limit,
        total: parseInt(counts[0].total),
        totalPages: Math.ceil(parseInt(counts[0].total) / limit),
      },
    })
  } catch (error) {
    console.error("[Admin Partners] Error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch partners" },
      { status: 500 }
    )
  }
}
