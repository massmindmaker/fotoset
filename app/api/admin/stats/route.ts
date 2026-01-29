/**
 * GET /api/admin/stats
 * Dashboard statistics and metrics
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getCurrentSession } from '@/lib/admin/session'

export async function GET() {
  const startTime = Date.now()
  console.log('[Admin Stats] Starting request...')

  try {
    console.log('[Admin Stats] Step 1: Getting session...')
    const t1 = Date.now()
    const session = await getCurrentSession()
    console.log(`[Admin Stats] Step 1 done in ${Date.now() - t1}ms, session: ${!!session}`)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // NOTE: We don't filter by test mode in stats - show ALL data
    // The mode toggle only affects which T-Bank terminal is used for NEW payments
    // Admin should see complete analytics regardless of current mode setting

    // Run all queries in parallel
    console.log('[Admin Stats] Step 2: Running 13 queries in parallel...')
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
      // Total users
      sql`SELECT COUNT(*) as count FROM users`,

      // Pro users (unique with succeeded payment)
      sql`SELECT COUNT(DISTINCT user_id) as count FROM payments WHERE status = 'succeeded'`,

      // Revenue MTD (split by currency)
      sql`
        SELECT
          COALESCE(SUM(CASE WHEN COALESCE(provider, 'tbank') = 'tbank' THEN amount ELSE 0 END), 0) as rub,
          COALESCE(SUM(CASE WHEN provider = 'stars' THEN stars_amount ELSE 0 END), 0) as stars,
          COALESCE(SUM(CASE WHEN provider = 'ton' THEN ton_amount ELSE 0 END), 0) as ton
        FROM payments
        WHERE status = 'succeeded'
        AND created_at >= DATE_TRUNC('month', NOW())
      `,

      // Revenue today (split by currency)
      sql`
        SELECT
          COALESCE(SUM(CASE WHEN COALESCE(provider, 'tbank') = 'tbank' THEN amount ELSE 0 END), 0) as rub,
          COALESCE(SUM(CASE WHEN provider = 'stars' THEN stars_amount ELSE 0 END), 0) as stars,
          COALESCE(SUM(CASE WHEN provider = 'ton' THEN ton_amount ELSE 0 END), 0) as ton
        FROM payments
        WHERE status = 'succeeded'
        AND created_at >= DATE_TRUNC('day', NOW())
      `,

      // Total completed generations
      sql`SELECT COUNT(*) as count FROM generation_jobs WHERE status = 'completed'`,

      // Pending generations
      sql`SELECT COUNT(*) as count FROM generation_jobs WHERE status IN ('pending', 'processing')`,

      // Tier distribution (tier_id column)
      sql`
        SELECT
          tier_id as tier,
          COUNT(*) as count,
          SUM(amount) as revenue
        FROM payments
        WHERE status = 'succeeded'
        GROUP BY tier_id
      `,

      // Revenue by day (last 30 days)
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

      // Registrations by day (last 30 days)
      sql`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as registrations
        FROM users
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,

      // Recent payments (last 10)
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

      // Recent users (last 10)
      sql`
        SELECT
          id,
          telegram_user_id,
          created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 10
      `,

      // Recent generations (last 10)
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

      // Provider stats (T-Bank, Stars, TON)
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

    console.log(`[Admin Stats] Step 2 done in ${Date.now() - t2}ms`)
    console.log('[Admin Stats] Step 3: Processing results...')
    const t3 = Date.now()

    // Calculate metrics
    const totalUsers = parseInt(usersTotal[0]?.count || '0', 10)
    const totalProUsers = parseInt(proUsers[0]?.count || '0', 10)

    // Revenue MTD by currency
    const revenueMtdRub = parseFloat(revenueMtd[0]?.rub || '0')
    const revenueMtdStars = parseInt(revenueMtd[0]?.stars || '0', 10)
    const revenueMtdTon = parseFloat(revenueMtd[0]?.ton || '0')

    // Revenue Today by currency
    const revenueTodayRub = parseFloat(revenueToday[0]?.rub || '0')
    const revenueTodayStars = parseInt(revenueToday[0]?.stars || '0', 10)
    const revenueTodayTon = parseFloat(revenueToday[0]?.ton || '0')

    const totalGenerations = parseInt(generationsTotal[0]?.count || '0', 10)
    const pendingGenerations = parseInt(generationsPending[0]?.count || '0', 10)

    // Conversion rate
    const conversionRate = totalUsers > 0
      ? ((totalProUsers / totalUsers) * 100).toFixed(1)
      : '0'

    // Average check (based on RUB only for simplicity)
    const avgCheck = totalProUsers > 0
      ? (revenueMtdRub / totalProUsers).toFixed(0)
      : '0'

    // Provider stats
    const providerStats = providerStatsResult.map((p: Record<string, unknown>) => ({
      provider: p.provider as string,
      totalCount: parseInt(String(p.total_count || 0), 10),
      successCount: parseInt(String(p.success_count || 0), 10),
      revenueRub: parseFloat(String(p.revenue_rub || 0)),
      totalStars: parseInt(String(p.total_stars || 0), 10),
      totalTon: parseFloat(String(p.total_ton || 0))
    }))

    // Tier distribution
    const tiers = tierStats.reduce((acc: Record<string, { count: number; revenue: number }>, t: any) => {
      acc[t.tier || 'unknown'] = {
        count: parseInt(t.count, 10),
        revenue: parseFloat(t.revenue)
      }
      return acc
    }, {})

    console.log(`[Admin Stats] Step 3 done in ${Date.now() - t3}ms`)
    console.log(`[Admin Stats] Total time: ${Date.now() - startTime}ms`)

    return NextResponse.json({
      kpi: {
        totalUsers,
        proUsers: totalProUsers,
        revenueMtd: {
          rub: revenueMtdRub,
          stars: revenueMtdStars,
          ton: revenueMtdTon
        },
        revenueToday: {
          rub: revenueTodayRub,
          stars: revenueTodayStars,
          ton: revenueTodayTon
        },
        conversionRate: parseFloat(conversionRate),
        avgCheck: parseFloat(avgCheck),
        totalGenerations,
        pendingGenerations
      },
      charts: {
        revenueByDay: revenueByDay.map((r: any) => ({
          date: r.date,
          revenue: parseFloat(r.revenue),
          transactions: parseInt(r.transactions, 10)
        })),
        registrationsByDay: registrationsByDay.map((r: any) => ({
          date: r.date,
          registrations: parseInt(r.registrations, 10)
        })),
        tierDistribution: tiers
      },
      providerStats,
      recent: {
        payments: recentPayments.map((p: any) => ({
          id: p.id,
          amount: parseFloat(p.amount),
          tier: p.tier,
          status: p.status,
          createdAt: p.created_at,
          telegramUserId: p.telegram_user_id,
          provider: p.provider,
          originalAmount: p.original_amount ? parseFloat(p.original_amount) : null,
          originalCurrency: p.original_currency
        })),
        users: recentUsers.map((u: any) => ({
          id: u.id,
          telegramUserId: u.telegram_user_id,
          createdAt: u.created_at
        })),
        generations: recentGenerations.map((g: any) => ({
          id: g.id,
          status: g.status,
          tier: g.tier,
          totalPhotos: g.total_photos,
          completedPhotos: g.completed_photos,
          createdAt: g.created_at,
          telegramUserId: g.telegram_user_id
        }))
      }
    })
  } catch (error) {
    console.error('[Admin Stats] Error after', Date.now() - startTime, 'ms:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch stats',
        debug: {
          elapsed: Date.now() - startTime,
          message: error instanceof Error ? error.message : String(error)
        }
      },
      { status: 500 }
    )
  }
}
