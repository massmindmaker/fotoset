/**
 * Test INSERT into admin_sessions
 * DELETE AFTER DEBUGGING
 */
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET() {
  const results: Record<string, unknown> = {}

  try {
    // Step 1: Generate test data
    const adminId = 1
    const sessionToken = crypto.randomUUID()
    const ipAddress = '127.0.0.1'
    const userAgent = 'TestAgent/1.0'
    const expiresAt = new Date(Date.now() + 86400 * 1000) // 24 hours

    results.step1_data = {
      adminId,
      sessionToken: sessionToken.substring(0, 20) + '...',
      ipAddress,
      userAgent,
      expiresAt: expiresAt.toISOString()
    }

    // Step 2: Try INSERT
    try {
      const [session] = await sql`
        INSERT INTO admin_sessions (admin_id, session_token, ip_address, user_agent, expires_at)
        VALUES (${adminId}, ${sessionToken}, ${ipAddress}, ${userAgent}, ${expiresAt.toISOString()})
        RETURNING id
      `
      results.step2_insert = { success: true, sessionId: session.id }

      // Cleanup: delete the test session
      await sql`DELETE FROM admin_sessions WHERE id = ${session.id}`
      results.step3_cleanup = { success: true }
    } catch (insertError) {
      results.step2_insert = {
        success: false,
        error: insertError instanceof Error ? insertError.message : String(insertError),
        stack: insertError instanceof Error ? insertError.stack?.split('\n').slice(0, 3) : undefined
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json({
      ...results,
      outerError: error instanceof Error ? error.message : String(error)
    })
  }
}
