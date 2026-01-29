/**
 * Check environment variables (safe subset)
 */
export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || ''

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    databaseUrlSuffix: dbUrl.slice(-60),
    databaseUrlLength: dbUrl.length,
    hasTbankKey: !!process.env.TBANK_TERMINAL_KEY,
    hasAdminSecret: !!process.env.ADMIN_SESSION_SECRET,
    timestamp: new Date().toISOString()
  })
}
