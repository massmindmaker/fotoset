/**
 * Debug: Test parallel queries with Promise.all
 * DELETE AFTER DEBUGGING
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(request: Request) {
  console.log('[TestParallel] Starting...')
  const startTime = Date.now()

  // Get query param for number of parallel queries
  const url = new URL(request.url)
  const count = parseInt(url.searchParams.get('count') || '4', 10)

  try {
    // Define all 13 queries
    const queries = [
      () => sql`SELECT COUNT(*) as count FROM users`,
      () => sql`SELECT COUNT(DISTINCT user_id) as count FROM payments WHERE status = 'succeeded'`,
      () => sql`SELECT COALESCE(SUM(CASE WHEN COALESCE(provider, 'tbank') = 'tbank' THEN amount ELSE 0 END), 0) as rub FROM payments WHERE status = 'succeeded' AND created_at >= DATE_TRUNC('month', NOW())`,
      () => sql`SELECT COALESCE(SUM(CASE WHEN COALESCE(provider, 'tbank') = 'tbank' THEN amount ELSE 0 END), 0) as rub FROM payments WHERE status = 'succeeded' AND created_at >= DATE_TRUNC('day', NOW())`,
      () => sql`SELECT COUNT(*) as count FROM generation_jobs WHERE status = 'completed'`,
      () => sql`SELECT COUNT(*) as count FROM generation_jobs WHERE status IN ('pending', 'processing')`,
      () => sql`SELECT tier_id as tier, COUNT(*) as count, SUM(amount) as revenue FROM payments WHERE status = 'succeeded' GROUP BY tier_id`,
      () => sql`SELECT DATE(created_at) as date, SUM(amount) as revenue, COUNT(*) as transactions FROM payments WHERE status = 'succeeded' AND created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY date ASC`,
      () => sql`SELECT DATE(created_at) as date, COUNT(*) as registrations FROM users WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY date ASC`,
      () => sql`SELECT p.id, p.amount FROM payments p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 10`,
      () => sql`SELECT id, telegram_user_id, created_at FROM users ORDER BY created_at DESC LIMIT 10`,
      () => sql`SELECT gj.id, gj.status FROM generation_jobs gj LEFT JOIN avatars a ON a.id = gj.avatar_id LEFT JOIN users u ON u.id = a.user_id ORDER BY gj.created_at DESC LIMIT 10`,
      () => sql`SELECT COALESCE(provider, 'tbank') as provider, COUNT(*) as total_count FROM payments GROUP BY COALESCE(provider, 'tbank') ORDER BY total_count DESC`,
    ]

    // Run only first N queries in parallel
    const selectedQueries = queries.slice(0, count)
    console.log(`[TestParallel] Running ${selectedQueries.length} queries in parallel...`)

    const t1 = Date.now()
    const results = await Promise.all(selectedQueries.map(q => q()))
    const parallelTime = Date.now() - t1

    console.log(`[TestParallel] Done in ${parallelTime}ms`)

    return NextResponse.json({
      success: true,
      queriesRun: count,
      parallelTime,
      totalTime: Date.now() - startTime,
      resultsCount: results.map(r => r.length)
    })
  } catch (error) {
    console.error('[TestParallel] Error:', error)
    return NextResponse.json({
      success: false,
      queriesRun: count,
      elapsed: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
