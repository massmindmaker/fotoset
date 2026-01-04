import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

const PARTNER_COMMISSION_RATE = 0.50 // 50% for partners
const REGULAR_COMMISSION_RATE = 0.10 // 10% for regular referrals

/**
 * POST /api/admin/partners/[id]
 * Approve or reject partner application
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const applicationId = parseInt(id)
    const body = await request.json()
    const { action, rejectionReason, adminNotes } = body

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Use 'approve' or 'reject'" },
        { status: 400 }
      )
    }

    // Get application
    const appResult = await sql`
      SELECT id, user_id, status, contact_name
      FROM partner_applications
      WHERE id = ${applicationId}
    `

    if (appResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      )
    }

    const application = appResult[0]

    if (application.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Application already processed" },
        { status: 400 }
      )
    }

    if (action === "approve") {
      // Update application status
      await sql`
        UPDATE partner_applications
        SET
          status = 'approved',
          reviewed_at = NOW(),
          reviewed_by = 'admin',
          admin_notes = ${adminNotes || null},
          updated_at = NOW()
        WHERE id = ${applicationId}
      `

      // Update or create referral_balances with partner status
      await sql`
        INSERT INTO referral_balances (user_id, is_partner, commission_rate, partner_approved_at, partner_approved_by)
        VALUES (${application.user_id}, TRUE, ${PARTNER_COMMISSION_RATE}, NOW(), 'admin')
        ON CONFLICT (user_id) DO UPDATE SET
          is_partner = TRUE,
          commission_rate = ${PARTNER_COMMISSION_RATE},
          partner_approved_at = NOW(),
          partner_approved_by = 'admin',
          updated_at = NOW()
      `

      console.log(`[Admin Partners] Approved application #${applicationId} for user ${application.user_id}`)

      return NextResponse.json({
        success: true,
        message: `Партнёр ${application.contact_name} одобрен! Комиссия: 50%`,
      })
    } else {
      // Reject
      if (!rejectionReason?.trim()) {
        return NextResponse.json(
          { success: false, error: "Укажите причину отказа" },
          { status: 400 }
        )
      }

      await sql`
        UPDATE partner_applications
        SET
          status = 'rejected',
          rejection_reason = ${rejectionReason.trim()},
          reviewed_at = NOW(),
          reviewed_by = 'admin',
          admin_notes = ${adminNotes || null},
          updated_at = NOW()
        WHERE id = ${applicationId}
      `

      console.log(`[Admin Partners] Rejected application #${applicationId}`)

      return NextResponse.json({
        success: true,
        message: `Заявка #${applicationId} отклонена`,
      })
    }
  } catch (error) {
    console.error("[Admin Partners] Action error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to process application" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/partners/[id]
 * Revoke partner status
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = parseInt(id)

    // Remove partner status
    await sql`
      UPDATE referral_balances
      SET
        is_partner = FALSE,
        commission_rate = ${REGULAR_COMMISSION_RATE},
        partner_approved_at = NULL,
        partner_approved_by = NULL,
        updated_at = NOW()
      WHERE user_id = ${userId}
    `

    console.log(`[Admin Partners] Revoked partner status for user ${userId}`)

    return NextResponse.json({
      success: true,
      message: "Партнёрский статус отозван. Комиссия: 10%",
    })
  } catch (error) {
    console.error("[Admin Partners] Revoke error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to revoke partner status" },
      { status: 500 }
    )
  }
}
