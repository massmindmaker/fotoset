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

    return NextResponse.json({
      success: true,
      data: {
        stats,
        dailyRevenue,
        tierBreakdown,
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
