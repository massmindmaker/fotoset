import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function GET() {
  const start = Date.now()

  let dbResult: { connected: boolean; time?: number; error?: string } = { connected: false }

  try {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      dbResult.error = 'DATABASE_URL not set'
    } else {
      const sql = neon(dbUrl)
      const dbStart = Date.now()
      await sql`SELECT 1 as test`
      dbResult = {
        connected: true,
        time: Date.now() - dbStart,
      }
    }
  } catch (error: unknown) {
    dbResult.error = error instanceof Error ? error.message : 'Unknown error'
  }

  return NextResponse.json({
    status: dbResult.connected ? 'ok' : 'error',
    runtime: 'edge',
    timestamp: new Date().toISOString(),
    responseTime: Date.now() - start,
    env: {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasNeonAuthUrl: !!process.env.NEON_AUTH_BASE_URL,
      nodeEnv: process.env.NODE_ENV,
    },
    database: dbResult,
  }, { status: dbResult.connected ? 200 : 500 })
}
