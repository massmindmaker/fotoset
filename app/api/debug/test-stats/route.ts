/**
 * Debug: Test stats query step by step
 * DELETE AFTER DEBUGGING
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  console.log('[TestStats] Starting...')
  const results: Record<string, unknown> = {}

  try {
    // Step 1: Simple count
    console.log('[TestStats] Step 1: Users count...')
    const t1 = Date.now()
    const usersTotal = await sql`SELECT COUNT(*) as count FROM users`
    results.step1_users = {
      time: Date.now() - t1,
      count: usersTotal[0]?.count
    }
    console.log('[TestStats] Step 1 done:', results.step1_users)

    // Step 2: Payments count
    console.log('[TestStats] Step 2: Payments count...')
    const t2 = Date.now()
    const paymentsTotal = await sql`SELECT COUNT(*) as count FROM payments WHERE status = 'succeeded'`
    results.step2_payments = {
      time: Date.now() - t2,
      count: paymentsTotal[0]?.count
    }
    console.log('[TestStats] Step 2 done:', results.step2_payments)

    // Step 3: Generation jobs count
    console.log('[TestStats] Step 3: Generation jobs count...')
    const t3 = Date.now()
    const jobsTotal = await sql`SELECT COUNT(*) as count FROM generation_jobs WHERE status = 'completed'`
    results.step3_jobs = {
      time: Date.now() - t3,
      count: jobsTotal[0]?.count
    }
    console.log('[TestStats] Step 3 done:', results.step3_jobs)

    // Step 4: Recent payments (small limit)
    console.log('[TestStats] Step 4: Recent payments...')
    const t4 = Date.now()
    const recentPayments = await sql`
      SELECT id, amount, status, created_at
      FROM payments
      ORDER BY created_at DESC
      LIMIT 5
    `
    results.step4_recent = {
      time: Date.now() - t4,
      count: recentPayments.length
    }
    console.log('[TestStats] Step 4 done:', results.step4_recent)

    // Step 5: Check if getCurrentSession hangs
    console.log('[TestStats] Step 5: Import session check...')
    const t5 = Date.now()
    const { getCurrentSession } = await import('@/lib/admin/session')
    results.step5_import = {
      time: Date.now() - t5,
      imported: typeof getCurrentSession === 'function'
    }
    console.log('[TestStats] Step 5 done:', results.step5_import)

    return NextResponse.json({
      success: true,
      results,
      totalTime: Object.values(results).reduce((sum: number, r: any) => sum + (r.time || 0), 0)
    })
  } catch (error) {
    console.error('[TestStats] Error:', error)
    return NextResponse.json({
      success: false,
      results,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined
    })
  }
}
