export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getCurrentSession } from "@/lib/admin/session"
import { hasPermission, type AdminRole } from "@/lib/admin/permissions"

/**
 * POST /api/admin/users/[userId]/partner
 * Toggle partner status for a user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const admin = await getCurrentSession()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    // SECURITY: Check permission for setting partner status
    if (!hasPermission(admin.role as AdminRole, 'users.set_partner')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      )
    }

    const { userId } = await params
    const { isPartner, commissionRate = 50 } = await request.json()

    // Convert percentage (50) to decimal (0.50) for database storage
    const commissionRateDecimal = commissionRate / 100
    const defaultRateDecimal = 0.10

    const userIdNum = parseInt(userId)
    if (isNaN(userIdNum)) {
      return NextResponse.json(
        { success: false, error: "Invalid userId" },
        { status: 400 }
      )
    }

    // Check if user exists
    const [user] = await sql`
      SELECT id, telegram_user_id FROM users WHERE id = ${userIdNum}
    `
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    // Check if referral_balances record exists
    const [existingBalance] = await sql`
      SELECT id FROM referral_balances WHERE user_id = ${userIdNum}
    `

    if (existingBalance) {
      // Update existing record
      await sql`
        UPDATE referral_balances
        SET
          is_partner = ${isPartner},
          commission_rate = ${isPartner ? commissionRateDecimal : defaultRateDecimal},
          partner_approved_at = ${isPartner ? new Date().toISOString() : null},
          partner_approved_by = ${isPartner ? admin.email : null},
          updated_at = NOW()
        WHERE user_id = ${userIdNum}
      `
    } else {
      // Create new record
      await sql`
        INSERT INTO referral_balances (
          user_id,
          balance,
          total_earned,
          total_withdrawn,
          referrals_count,
          commission_rate,
          is_partner,
          partner_approved_at,
          partner_approved_by,
          updated_at
        ) VALUES (
          ${userIdNum},
          0,
          0,
          0,
          0,
          ${isPartner ? commissionRateDecimal : defaultRateDecimal},
          ${isPartner},
          ${isPartner ? new Date().toISOString() : null},
          ${isPartner ? admin.email : null},
          NOW()
        )
      `
    }

    console.log(`[Admin] User ${userIdNum} partner status changed to ${isPartner} by ${admin.email}`)

    return NextResponse.json({
      success: true,
      data: {
        userId: userIdNum,
        isPartner,
        commissionRate: isPartner ? commissionRateDecimal : defaultRateDecimal,
      },
    })
  } catch (error) {
    console.error("[Admin API] Error toggling partner status:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
