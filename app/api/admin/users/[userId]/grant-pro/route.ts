import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getCurrentSession, type AdminSession } from "@/lib/admin/session"
import { hasPermission, type AdminRole } from "@/lib/admin/permissions"

/**
 * POST /api/admin/users/[userId]/grant-pro
 *
 * Grants free Pro access to a user by creating a payment with status='granted'
 * This allows the user to generate photos without paying.
 *
 * Request body:
 * - tier_id: 'starter' | 'standard' | 'premium' (default: 'premium')
 * - reason?: string - Optional reason for granting Pro
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Verify admin session
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    // SECURITY: Check permission for granting Pro status
    if (!hasPermission(session.role as AdminRole, 'users.grant_pro')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      )
    }

    const { userId } = await params
    const userIdNum = parseInt(userId, 10)

    if (isNaN(userIdNum)) {
      return NextResponse.json(
        { success: false, error: "Invalid user ID" },
        { status: 400 }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const tierId = body.tier_id || 'premium'
    const reason = body.reason || 'Granted by admin'

    // Validate tier_id
    const validTiers = ['starter', 'standard', 'premium']
    if (!validTiers.includes(tierId)) {
      return NextResponse.json(
        { success: false, error: "Invalid tier ID" },
        { status: 400 }
      )
    }

    // Get photo count for tier
    const photoCountMap: Record<string, number> = {
      starter: 7,
      standard: 15,
      premium: 23
    }
    const photoCount = photoCountMap[tierId]

    // Verify user exists
    const users = await sql`
      SELECT id, telegram_user_id, telegram_username
      FROM users
      WHERE id = ${userIdNum}
    `

    if (users.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    const user = users[0]

    // SECURITY FIX: Prevent abuse - check for existing unused admin-granted payments
    // Admin can only grant one free payment at a time per user
    const existingGranted = await sql`
      SELECT id, tier_id, photo_count, photos_used, created_at
      FROM payments
      WHERE user_id = ${userIdNum}
        AND provider = 'admin'
        AND status = 'succeeded'
        AND (photos_used IS NULL OR photos_used < photo_count)
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (existingGranted.length > 0) {
      const existing = existingGranted[0]
      return NextResponse.json(
        {
          success: false,
          error: "User already has unused admin-granted access",
          existing: {
            payment_id: existing.id,
            tier_id: existing.tier_id,
            photo_count: existing.photo_count,
            photos_used: existing.photos_used || 0,
            granted_at: existing.created_at
          }
        },
        { status: 409 }  // Conflict
      )
    }

    // Generate a unique granted payment ID
    const grantedPaymentId = `granted_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // Create granted payment record
    const payment = await sql`
      INSERT INTO payments (
        user_id,
        tbank_payment_id,
        provider,
        amount,
        currency,
        status,
        tier_id,
        photo_count,
        error_message,
        created_at
      ) VALUES (
        ${userIdNum},
        ${grantedPaymentId},
        ${'admin'},
        ${0},
        ${'RUB'},
        ${'succeeded'},
        ${tierId},
        ${photoCount},
        ${reason},
        NOW()
      )
      RETURNING id
    `

    // Log the action to admin_logs if the table exists
    try {
      await sql`
        INSERT INTO admin_logs (
          admin_id,
          action,
          entity_type,
          entity_id,
          details,
          created_at
        ) VALUES (
          ${session.adminId},
          ${'grant_pro'},
          ${'user'},
          ${userIdNum},
          ${JSON.stringify({
            tier_id: tierId,
            photo_count: photoCount,
            reason,
            payment_id: payment[0].id,
            telegram_user_id: user.telegram_user_id,
            telegram_username: user.telegram_username
          })},
          NOW()
        )
      `
    } catch {
      // admin_logs table might not exist, continue silently
      console.log('[Admin API] admin_logs table not found, skipping audit log')
    }

    return NextResponse.json({
      success: true,
      data: {
        payment_id: payment[0].id,
        tier_id: tierId,
        photo_count: photoCount,
        message: `Pro access granted: ${tierId} (${photoCount} photos)`
      }
    })
  } catch (error) {
    console.error("[Admin API] Error granting Pro status:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
