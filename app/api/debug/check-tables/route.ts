/**
 * Debug endpoint to check table structure
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    // Check admin/session tables
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('admin_users', 'admin_sessions', 'partner_users', 'partner_sessions', 'login_attempts')
      ORDER BY table_name
    `

    // Check admin_sessions columns
    let sessionColumns: Record<string, unknown>[] = []
    let sessionError = null
    try {
      sessionColumns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'admin_sessions'
        ORDER BY ordinal_position
      `
    } catch (e) {
      sessionError = e instanceof Error ? e.message : String(e)
    }

    // Count admin_sessions
    let sessionsCount = null
    try {
      const [result] = await sql`SELECT COUNT(*) as count FROM admin_sessions`
      sessionsCount = result.count
    } catch (e) {
      // Ignore
    }

    // Check ADMIN_SESSION_SECRET
    const hasSecret = !!process.env.ADMIN_SESSION_SECRET
    const secretLength = process.env.ADMIN_SESSION_SECRET?.length || 0

    return NextResponse.json({
      tables: tables.map((t: { table_name: string }) => t.table_name),
      adminSessions: {
        columns: sessionColumns,
        count: sessionsCount,
        error: sessionError
      },
      env: {
        hasAdminSecret: hasSecret,
        secretLength,
        nodeEnv: process.env.NODE_ENV
      }
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
