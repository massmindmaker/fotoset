import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

/**
 * GET /api/admin/payments/stats
 *
 * Returns payment statistics and revenue analytics
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     stats: PaymentStats,
 *     dailyRevenue: DailyRevenue[],
 *     tierBreakdown: TierBreakdown[]
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Overall stats
    const statsResult = await sql`
      SELECT
        -- Total revenue (all succeeded payments)
        SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as total_revenue,

        -- Net revenue (after refunds)
        SUM(CASE WHEN status = 'succeeded' THEN amount - COALESCE(refund_amount, 0) ELSE 0 END) as net_revenue,

        -- Average order value (succeeded only)
        AVG(CASE WHEN status = 'succeeded' THEN amount END) as avg_order_value,

        -- Conversion rate (succeeded / total)
        COUNT(CASE WHEN status = 'succeeded' THEN 1 END)::float / NULLIF(COUNT(*), 0) as conversion_rate,

        -- Total payments count
        COUNT(*) as total_payments,

        -- Refunded stats
        COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_count,
        SUM(CASE WHEN status = 'refunded' THEN refund_amount ELSE 0 END) as refunded_amount

      FROM payments
    `

    const stats = {
      total_revenue: parseFloat(statsResult[0].total_revenue || 0),
      net_revenue: parseFloat(statsResult[0].net_revenue || 0),
      avg_order_value: parseFloat(statsResult[0].avg_order_value || 0),
      conversion_rate: parseFloat(statsResult[0].conversion_rate || 0),
      total_payments: parseInt(statsResult[0].total_payments || 0),
      refunded_count: parseInt(statsResult[0].refunded_count || 0),
      refunded_amount: parseFloat(statsResult[0].refunded_amount || 0),
    }

    // Daily revenue (last 30 days)
    const dailyRevenueResult = await sql`
      SELECT
        DATE(created_at) as date,
        SUM(amount) as revenue,
        COUNT(*) as count
      FROM payments
      WHERE status = 'succeeded'
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `

    const dailyRevenue = dailyRevenueResult.map((row: any) => ({
      date: row.date,
      revenue: parseFloat(row.revenue),
      count: parseInt(row.count),
    }))

    // Revenue by tier
    const tierBreakdownResult = await sql`
      SELECT
        COALESCE(tier_id, 'unknown') as tier_id,
        COUNT(*) as count,
        SUM(amount) as revenue
      FROM payments
      WHERE status = 'succeeded'
      GROUP BY tier_id
      ORDER BY revenue DESC
    `

    const tierBreakdown = tierBreakdownResult.map((row: any) => ({
      tier_id: row.tier_id,
      count: parseInt(row.count),
      revenue: parseFloat(row.revenue),
    }))

    // Stats by provider (T-Bank, Stars, TON)
    const providerStatsResult = await sql`
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

    const providerStats = providerStatsResult.map((row: any) => ({
      provider: row.provider,
      total_count: parseInt(row.total_count || 0),
      success_count: parseInt(row.success_count || 0),
      revenue_rub: parseFloat(row.revenue_rub || 0),
      total_stars: parseInt(row.total_stars || 0),
      total_ton: parseFloat(row.total_ton || 0),
    }))

    // Daily revenue by provider (last 30 days)
    const dailyByProviderResult = await sql`
      SELECT
        DATE(created_at) as date,
        COALESCE(provider, 'tbank') as provider,
        SUM(amount) as revenue,
        COUNT(*) as count
      FROM payments
      WHERE status = 'succeeded'
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at), COALESCE(provider, 'tbank')
      ORDER BY date DESC, provider
    `

    const dailyByProvider = dailyByProviderResult.map((row: any) => ({
      date: row.date,
      provider: row.provider,
      revenue: parseFloat(row.revenue),
      count: parseInt(row.count),
    }))

    return NextResponse.json({
      success: true,
      data: {
        stats,
        dailyRevenue,
        tierBreakdown,
        providerStats,
        dailyByProvider,
      },
    })

  } catch (error) {
    console.error("[Admin API] Error fetching payment stats:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "STATS_ERROR",
          userMessage: "Ошибка загрузки статистики",
          devMessage: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    )
  }
}
