/**
 * Debug: Test session + stats step by step
 * DELETE AFTER DEBUGGING
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  console.log('[TestSessionStats] Starting...')
  const startTime = Date.now()
  const results: Record<string, unknown> = {}

  try {
    // Step 1: Simple query to verify DB connection
    console.log('[TestSessionStats] Step 1: DB connection test...')
    const t1 = Date.now()
    const dbTest = await sql`SELECT 1 as test`
    results.step1_db = {
      time: Date.now() - t1,
      success: dbTest[0]?.test === 1
    }
    console.log('[TestSessionStats] Step 1 done:', results.step1_db)

    // Step 2: Import session module (not call it yet)
    console.log('[TestSessionStats] Step 2: Import session module...')
    const t2 = Date.now()
    const sessionModule = await import('@/lib/admin/session')
    results.step2_import = {
      time: Date.now() - t2,
      hasGetCurrentSession: typeof sessionModule.getCurrentSession === 'function'
    }
    console.log('[TestSessionStats] Step 2 done:', results.step2_import)

    // Step 3: Check for admin_session cookie existence
    console.log('[TestSessionStats] Step 3: Check cookies...')
    const t3 = Date.now()
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const adminCookie = cookieStore.get('admin_session')
    results.step3_cookie = {
      time: Date.now() - t3,
      exists: !!adminCookie,
      length: adminCookie?.value?.length || 0
    }
    console.log('[TestSessionStats] Step 3 done:', results.step3_cookie)

    // Step 4: If cookie exists, try to verify it
    if (adminCookie?.value) {
      console.log('[TestSessionStats] Step 4: Verify JWT...')
      const t4 = Date.now()
      try {
        const session = await sessionModule.getCurrentSession()
        results.step4_session = {
          time: Date.now() - t4,
          success: !!session,
          adminId: session?.adminId,
          email: session?.email?.substring(0, 5) + '***'
        }
      } catch (e) {
        results.step4_session = {
          time: Date.now() - t4,
          error: e instanceof Error ? e.message : String(e)
        }
      }
      console.log('[TestSessionStats] Step 4 done:', results.step4_session)
    } else {
      results.step4_session = { skipped: 'no cookie' }
    }

    // Step 5: Run one simple stats query
    console.log('[TestSessionStats] Step 5: Simple stats query...')
    const t5 = Date.now()
    const userCount = await sql`SELECT COUNT(*) as count FROM users`
    results.step5_stats = {
      time: Date.now() - t5,
      count: userCount[0]?.count
    }
    console.log('[TestSessionStats] Step 5 done:', results.step5_stats)

    // Step 6: Run the 13 queries in parallel (like stats endpoint)
    console.log('[TestSessionStats] Step 6: Parallel queries...')
    const t6 = Date.now()

    const [
      usersTotal,
      proUsers,
      generationsTotal,
      generationsPending,
    ] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM users`,
      sql`SELECT COUNT(DISTINCT user_id) as count FROM payments WHERE status = 'succeeded'`,
      sql`SELECT COUNT(*) as count FROM generation_jobs WHERE status = 'completed'`,
      sql`SELECT COUNT(*) as count FROM generation_jobs WHERE status IN ('pending', 'processing')`,
    ])

    results.step6_parallel = {
      time: Date.now() - t6,
      users: usersTotal[0]?.count,
      pro: proUsers[0]?.count,
      generations: generationsTotal[0]?.count,
      pending: generationsPending[0]?.count
    }
    console.log('[TestSessionStats] Step 6 done:', results.step6_parallel)

    const totalTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      results,
      totalTime
    })
  } catch (error) {
    console.error('[TestSessionStats] Error:', error)
    return NextResponse.json({
      success: false,
      results,
      error: error instanceof Error ? error.message : String(error),
      elapsed: Date.now() - startTime
    })
  }
}
