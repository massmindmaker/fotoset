/**
 * Debug: Test session check + parallel queries (like stats endpoint)
 * DELETE AFTER DEBUGGING
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getCurrentSession } from '@/lib/admin/session'

export async function GET() {
  console.log('[TestSessionPlusQueries] Starting...')
  const startTime = Date.now()
  const timings: Record<string, number> = {}

  try {
    // Step 1: Get session (like stats endpoint does)
    console.log('[TestSessionPlusQueries] Getting session...')
    const t1 = Date.now()
    const session = await getCurrentSession()
    timings.sessionTime = Date.now() - t1
    console.log(`[TestSessionPlusQueries] Session: ${!!session} (${timings.sessionTime}ms)`)

    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'No session',
        timings,
        totalTime: Date.now() - startTime
      })
    }

    // Step 2: Run all 13 queries in parallel (like stats endpoint)
    console.log('[TestSessionPlusQueries] Running 13 parallel queries...')
    const t2 = Date.now()

    const [
      usersTotal,
      proUsers,
      revenueMtd,
      revenueToday,
      generationsTotal,
      generationsPending,
      tierStats,
      revenueByDay,
      registrationsByDay,
      recentPayments,
      recentUsers,
      recentGenerations,
      providerStatsResult
    ] = await Promise.all([
      // Query 1: Total users
      sql`SELECT COUNT(*) as count FROM users`,

      // Query 2: Pro users
      sql`SELECT COUNT(DISTINCT user_id) as count FROM payments WHERE status = 'succeeded'`,

      // Query 3: Revenue MTD
      sql`
        SELECT
          COALESCE(SUM(CASE WHEN COALESCE(provider, 'tbank') = 'tbank' THEN amount ELSE 0 END), 0) as rub,
          COALESCE(SUM(CASE WHEN provider = 'stars' THEN stars_amount ELSE 0 END), 0) as stars,
          COALESCE(SUM(CASE WHEN provider = 'ton' THEN ton_amount ELSE 0 END), 0) as ton
        FROM payments
        WHERE status = 'succeeded'
        AND created_at >= DATE_TRUNC('month', NOW())
      `,

      // Query 4: Revenue Today
      sql`
        SELECT
          COALESCE(SUM(CASE WHEN COALESCE(provider, 'tbank') = 'tbank' THEN amount ELSE 0 END), 0) as rub,
          COALESCE(SUM(CASE WHEN provider = 'stars' THEN stars_amount ELSE 0 END), 0) as stars,
          COALESCE(SUM(CASE WHEN provider = 'ton' THEN ton_amount ELSE 0 END), 0) as ton
        FROM payments
        WHERE status = 'succeeded'
        AND created_at >= DATE_TRUNC('day', NOW())
      `,

      // Query 5: Total generations
      sql`SELECT COUNT(*) as count FROM generation_jobs WHERE status = 'completed'`,

      // Query 6: Pending generations
      sql`SELECT COUNT(*) as count FROM generation_jobs WHERE status IN ('pending', 'processing')`,

      // Query 7: Tier stats
      sql`
        SELECT
          tier_id as tier,
          COUNT(*) as count,
          SUM(amount) as revenue
        FROM payments
        WHERE status = 'succeeded'
        GROUP BY tier_id
      `,

      // Query 8: Revenue by day
      sql`
        SELECT
          DATE(created_at) as date,
          SUM(amount) as revenue,
          COUNT(*) as transactions
        FROM payments
        WHERE status = 'succeeded'
        AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,

      // Query 9: Registrations by day
      sql`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as registrations
        FROM users
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,

      // Query 10: Recent payments
      sql`
        SELECT
          p.id,
          p.amount,
          p.tier_id as tier,
          p.status,
          p.created_at,
          u.telegram_user_id,
          COALESCE(p.provider, 'tbank') as provider,
          p.original_amount,
          p.original_currency
        FROM payments p
        LEFT JOIN users u ON u.id = p.user_id
        ORDER BY p.created_at DESC
        LIMIT 10
      `,

      // Query 11: Recent users
      sql`
        SELECT
          id,
          telegram_user_id,
          created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 10
      `,

      // Query 12: Recent generations
      sql`
        SELECT
          gj.id,
          gj.status,
          gj.style_id as tier,
          gj.total_photos,
          gj.completed_photos,
          gj.created_at,
          u.telegram_user_id
        FROM generation_jobs gj
        LEFT JOIN avatars a ON a.id = gj.avatar_id
        LEFT JOIN users u ON u.id = a.user_id
        ORDER BY gj.created_at DESC
        LIMIT 10
      `,

      // Query 13: Provider stats
      sql`
        SELECT
          COALESCE(provider, 'tbank') as provider,
          COUNT(*) as total_count,
          COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as success_count,
          SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as revenue_rub,
          SUM(CASE WHEN status = 'succeeded' AND original_currency = 'XTR' THEN original_amount ELSE 0 END) as total_stars,
          SUM(CASE WHEN status = 'succeeded' AND original_currency = 'TON' THEN original_amount ELSE 0 END) as total_ton
        FROM payments
        GROUP BY COALESCE(provider, 'tbank')
        ORDER BY revenue_rub DESC
      `
    ])

    timings.queriesTime = Date.now() - t2
    console.log(`[TestSessionPlusQueries] Queries done (${timings.queriesTime}ms)`)

    // Step 3: Return basic stats
    return NextResponse.json({
      success: true,
      session: {
        adminId: session.adminId,
        email: session.email?.substring(0, 5) + '***'
      },
      stats: {
        totalUsers: parseInt(usersTotal[0]?.count || '0', 10),
        proUsers: parseInt(proUsers[0]?.count || '0', 10),
        totalGenerations: parseInt(generationsTotal[0]?.count || '0', 10),
        pendingGenerations: parseInt(generationsPending[0]?.count || '0', 10),
        recentPaymentsCount: recentPayments.length,
        recentUsersCount: recentUsers.length,
        recentGenerationsCount: recentGenerations.length,
        providerStatsCount: providerStatsResult.length
      },
      timings,
      totalTime: Date.now() - startTime
    })
  } catch (error) {
    console.error('[TestSessionPlusQueries] Error:', error)
    return NextResponse.json({
      success: false,
      timings,
      totalTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
