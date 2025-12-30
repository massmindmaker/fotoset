/**
 * GET /api/admin/stats
 * Dashboard statistics and metrics
 */

import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

export async function GET() {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = getSql()

    // Run all queries in parallel
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
      recentGenerations
    ] = await Promise.all([
      // Total users
      sql`SELECT COUNT(*) as count FROM users`,

      // Pro users (unique with succeeded payment)
      sql`SELECT COUNT(DISTINCT user_id) as count FROM payments WHERE status = 'succeeded'`,

      // Revenue MTD
      sql`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE status = 'succeeded'
        AND created_at >= DATE_TRUNC('month', NOW())
      `,

      // Revenue today
      sql`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE status = 'succeeded'
        AND created_at >= DATE_TRUNC('day', NOW())
      `,

      // Total completed generations
      sql`SELECT COUNT(*) as count FROM generation_jobs WHERE status = 'completed'`,

      // Pending generations
      sql`SELECT COUNT(*) as count FROM generation_jobs WHERE status IN ('pending', 'processing')`,

      // Tier distribution (tier_id column, not tier)
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
          u.telegram_user_id
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
      `
    ])

    // Calculate metrics
    const totalUsers = parseInt(usersTotal[0]?.count || '0', 10)
    const totalProUsers = parseInt(proUsers[0]?.count || '0', 10)
    const totalRevenueMtd = parseFloat(revenueMtd[0]?.total || '0')
    const totalRevenueToday = parseFloat(revenueToday[0]?.total || '0')
    const totalGenerations = parseInt(generationsTotal[0]?.count || '0', 10)
    const pendingGenerations = parseInt(generationsPending[0]?.count || '0', 10)

    // Conversion rate
    const conversionRate = totalUsers > 0
      ? ((totalProUsers / totalUsers) * 100).toFixed(1)
      : '0'

    // Average check
    const avgCheck = totalProUsers > 0
      ? (totalRevenueMtd / totalProUsers).toFixed(0)
      : '0'

    // Tier distribution
    const tiers = tierStats.reduce((acc: Record<string, { count: number; revenue: number }>, t) => {
      acc[t.tier || 'unknown'] = {
        count: parseInt(t.count, 10),
        revenue: parseFloat(t.revenue)
      }
      return acc
    }, {})

    return NextResponse.json({
      kpi: {
        totalUsers,
        proUsers: totalProUsers,
        revenueMtd: totalRevenueMtd,
        revenueToday: totalRevenueToday,
        conversionRate: parseFloat(conversionRate),
        avgCheck: parseFloat(avgCheck),
        totalGenerations,
        pendingGenerations
      },
      charts: {
        revenueByDay: revenueByDay.map(r => ({
          date: r.date,
          revenue: parseFloat(r.revenue),
          transactions: parseInt(r.transactions, 10)
        })),
        registrationsByDay: registrationsByDay.map(r => ({
          date: r.date,
          registrations: parseInt(r.registrations, 10)
        })),
        tierDistribution: tiers
      },
      recent: {
        payments: recentPayments.map(p => ({
          id: p.id,
          amount: parseFloat(p.amount),
          tier: p.tier,
          status: p.status,
          createdAt: p.created_at,
          telegramUserId: p.telegram_user_id
        })),
        users: recentUsers.map(u => ({
          id: u.id,
          telegramUserId: u.telegram_user_id,
          createdAt: u.created_at
        })),
        generations: recentGenerations.map(g => ({
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
    console.error('[Admin Stats] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
