/**
 * Debug: Test all 13 stats queries individually
 * DELETE AFTER DEBUGGING
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  console.log('[TestAllStatsQueries] Starting...')
  const startTime = Date.now()
  const results: Record<string, { time: number; count?: number; error?: string }> = {}

  // Query 1: Total users
  const t1 = Date.now()
  try {
    const r = await sql`SELECT COUNT(*) as count FROM users`
    results.q1_usersTotal = { time: Date.now() - t1, count: parseInt(r[0]?.count || '0', 10) }
  } catch (e) {
    results.q1_usersTotal = { time: Date.now() - t1, error: String(e) }
  }
  console.log('[TestAllStatsQueries] Q1:', results.q1_usersTotal)

  // Query 2: Pro users
  const t2 = Date.now()
  try {
    const r = await sql`SELECT COUNT(DISTINCT user_id) as count FROM payments WHERE status = 'succeeded'`
    results.q2_proUsers = { time: Date.now() - t2, count: parseInt(r[0]?.count || '0', 10) }
  } catch (e) {
    results.q2_proUsers = { time: Date.now() - t2, error: String(e) }
  }
  console.log('[TestAllStatsQueries] Q2:', results.q2_proUsers)

  // Query 3: Revenue MTD (complex aggregation)
  const t3 = Date.now()
  try {
    const r = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN COALESCE(provider, 'tbank') = 'tbank' THEN amount ELSE 0 END), 0) as rub,
        COALESCE(SUM(CASE WHEN provider = 'stars' THEN stars_amount ELSE 0 END), 0) as stars,
        COALESCE(SUM(CASE WHEN provider = 'ton' THEN ton_amount ELSE 0 END), 0) as ton
      FROM payments
      WHERE status = 'succeeded'
      AND created_at >= DATE_TRUNC('month', NOW())
    `
    results.q3_revenueMtd = { time: Date.now() - t3, count: 1 }
  } catch (e) {
    results.q3_revenueMtd = { time: Date.now() - t3, error: String(e) }
  }
  console.log('[TestAllStatsQueries] Q3:', results.q3_revenueMtd)

  // Query 4: Revenue Today
  const t4 = Date.now()
  try {
    const r = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN COALESCE(provider, 'tbank') = 'tbank' THEN amount ELSE 0 END), 0) as rub,
        COALESCE(SUM(CASE WHEN provider = 'stars' THEN stars_amount ELSE 0 END), 0) as stars,
        COALESCE(SUM(CASE WHEN provider = 'ton' THEN ton_amount ELSE 0 END), 0) as ton
      FROM payments
      WHERE status = 'succeeded'
      AND created_at >= DATE_TRUNC('day', NOW())
    `
    results.q4_revenueToday = { time: Date.now() - t4, count: 1 }
  } catch (e) {
    results.q4_revenueToday = { time: Date.now() - t4, error: String(e) }
  }
  console.log('[TestAllStatsQueries] Q4:', results.q4_revenueToday)

  // Query 5: Total generations
  const t5 = Date.now()
  try {
    const r = await sql`SELECT COUNT(*) as count FROM generation_jobs WHERE status = 'completed'`
    results.q5_generationsTotal = { time: Date.now() - t5, count: parseInt(r[0]?.count || '0', 10) }
  } catch (e) {
    results.q5_generationsTotal = { time: Date.now() - t5, error: String(e) }
  }
  console.log('[TestAllStatsQueries] Q5:', results.q5_generationsTotal)

  // Query 6: Pending generations
  const t6 = Date.now()
  try {
    const r = await sql`SELECT COUNT(*) as count FROM generation_jobs WHERE status IN ('pending', 'processing')`
    results.q6_generationsPending = { time: Date.now() - t6, count: parseInt(r[0]?.count || '0', 10) }
  } catch (e) {
    results.q6_generationsPending = { time: Date.now() - t6, error: String(e) }
  }
  console.log('[TestAllStatsQueries] Q6:', results.q6_generationsPending)

  // Query 7: Tier stats (GROUP BY)
  const t7 = Date.now()
  try {
    const r = await sql`
      SELECT
        tier_id as tier,
        COUNT(*) as count,
        SUM(amount) as revenue
      FROM payments
      WHERE status = 'succeeded'
      GROUP BY tier_id
    `
    results.q7_tierStats = { time: Date.now() - t7, count: r.length }
  } catch (e) {
    results.q7_tierStats = { time: Date.now() - t7, error: String(e) }
  }
  console.log('[TestAllStatsQueries] Q7:', results.q7_tierStats)

  // Query 8: Revenue by day (30 days aggregation)
  const t8 = Date.now()
  try {
    const r = await sql`
      SELECT
        DATE(created_at) as date,
        SUM(amount) as revenue,
        COUNT(*) as transactions
      FROM payments
      WHERE status = 'succeeded'
      AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `
    results.q8_revenueByDay = { time: Date.now() - t8, count: r.length }
  } catch (e) {
    results.q8_revenueByDay = { time: Date.now() - t8, error: String(e) }
  }
  console.log('[TestAllStatsQueries] Q8:', results.q8_revenueByDay)

  // Query 9: Registrations by day (30 days)
  const t9 = Date.now()
  try {
    const r = await sql`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as registrations
      FROM users
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `
    results.q9_registrationsByDay = { time: Date.now() - t9, count: r.length }
  } catch (e) {
    results.q9_registrationsByDay = { time: Date.now() - t9, error: String(e) }
  }
  console.log('[TestAllStatsQueries] Q9:', results.q9_registrationsByDay)

  // Query 10: Recent payments (JOIN)
  const t10 = Date.now()
  try {
    const r = await sql`
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
    `
    results.q10_recentPayments = { time: Date.now() - t10, count: r.length }
  } catch (e) {
    results.q10_recentPayments = { time: Date.now() - t10, error: String(e) }
  }
  console.log('[TestAllStatsQueries] Q10:', results.q10_recentPayments)

  // Query 11: Recent users
  const t11 = Date.now()
  try {
    const r = await sql`
      SELECT
        id,
        telegram_user_id,
        created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `
    results.q11_recentUsers = { time: Date.now() - t11, count: r.length }
  } catch (e) {
    results.q11_recentUsers = { time: Date.now() - t11, error: String(e) }
  }
  console.log('[TestAllStatsQueries] Q11:', results.q11_recentUsers)

  // Query 12: Recent generations (multiple JOINs)
  const t12 = Date.now()
  try {
    const r = await sql`
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
    results.q12_recentGenerations = { time: Date.now() - t12, count: r.length }
  } catch (e) {
    results.q12_recentGenerations = { time: Date.now() - t12, error: String(e) }
  }
  console.log('[TestAllStatsQueries] Q12:', results.q12_recentGenerations)

  // Query 13: Provider stats (complex GROUP BY)
  const t13 = Date.now()
  try {
    const r = await sql`
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
    results.q13_providerStats = { time: Date.now() - t13, count: r.length }
  } catch (e) {
    results.q13_providerStats = { time: Date.now() - t13, error: String(e) }
  }
  console.log('[TestAllStatsQueries] Q13:', results.q13_providerStats)

  const totalTime = Date.now() - startTime
  const totalQueryTime = Object.values(results).reduce((sum, r) => sum + r.time, 0)

  return NextResponse.json({
    success: true,
    results,
    totalTime,
    totalQueryTime,
    queriesWithErrors: Object.entries(results).filter(([_, v]) => v.error).map(([k]) => k)
  })
}
