/**
 * Debug endpoint to check environment variables
 * REMOVE AFTER DEBUGGING
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || ''

  // Mask password
  const masked = dbUrl.replace(/:([^:@]+)@/, ':***@')

  // Extract host
  const hostMatch = dbUrl.match(/@([^/]+)/)
  const host = hostMatch ? hostMatch[1] : 'unknown'

  // Get full host for debugging
  const fullHost = hostMatch ? hostMatch[1] : 'unknown'

  return NextResponse.json({
    hasDbUrl: !!process.env.DATABASE_URL,
    fullHost,
    dbName: dbUrl.split('/').pop()?.split('?')[0] || 'unknown',
    urlLength: dbUrl.length
  })
}
