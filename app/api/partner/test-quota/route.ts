import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getCurrentPartnerSession } from "@/lib/partner/session"
import { extractIdentifierFromRequest, findUserByIdentifier } from "@/lib/user-identity"

/**
 * Helper to get authenticated partner user ID
 */
async function getPartnerUserId(request: NextRequest): Promise<number | null> {
  // Priority 1: Partner session cookie
  try {
    const sessionPromise = getCurrentPartnerSession()
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
    const session = await Promise.race([sessionPromise, timeoutPromise])
    if (session?.userId) {
      return session.userId
    }
  } catch (e) {
    console.error('[Partner Test Quota] Session check error:', e)
  }

  // Priority 2: Query params (Telegram/Neon auth)
  const { searchParams } = new URL(request.url)
  const telegramUserId = searchParams.get('telegram_user_id')
  const neonUserId = searchParams.get('neon_auth_id') || searchParams.get('neon_user_id')

  if (telegramUserId || neonUserId) {
    const identifier = extractIdentifierFromRequest({
      telegram_user_id: telegramUserId,
      neon_auth_id: neonUserId
    })
    const basicUser = await findUserByIdentifier(identifier)
    if (basicUser) {
      return basicUser.id
    }
  }

  return null
}

/**
 * GET /api/partner/test-quota
 * Get partner's test generation quota (used/limit)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getPartnerUserId(request)

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      )
    }

    // Get partner status and quota
    const result = await sql`
      SELECT 
        is_partner,
        test_generations_limit,
        test_generations_used
      FROM referral_balances 
      WHERE user_id = ${userId}
    `

    if (result.length === 0 || !result[0].is_partner) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Partner status required" },
        { status: 403 }
      )
    }

    const quota = result[0]

    return NextResponse.json({
      success: true,
      quota: {
        limit: quota.test_generations_limit || 200,
        used: quota.test_generations_used || 0,
        remaining: (quota.test_generations_limit || 200) - (quota.test_generations_used || 0)
      }
    })
  } catch (error) {
    console.error("[Partner Test Quota] Error:", error)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to get quota" },
      { status: 500 }
    )
  }
}
