/**
 * Test INSERT in Node.js runtime
 * DELETE AFTER DEBUGGING
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  console.log('[TestNodejsInsert] Starting...')

  try {
    console.log('[TestNodejsInsert] Generating data...')
    const sessionToken = crypto.randomUUID()

    console.log('[TestNodejsInsert] Executing INSERT...')
    const [session] = await sql`
      INSERT INTO admin_sessions (admin_id, session_token, ip_address, user_agent, expires_at)
      VALUES (1, ${sessionToken}, '127.0.0.1', 'Test', ${new Date(Date.now() + 86400000).toISOString()})
      RETURNING id
    `
    console.log('[TestNodejsInsert] INSERT done, id:', session.id)

    // Cleanup
    console.log('[TestNodejsInsert] Cleanup...')
    await sql`DELETE FROM admin_sessions WHERE id = ${session.id}`
    console.log('[TestNodejsInsert] Done')

    return NextResponse.json({ success: true, sessionId: session.id })
  } catch (error) {
    console.error('[TestNodejsInsert] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
