/**
 * Simple test endpoint for admin auth
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    env: {
      hasAdminSecret: !!process.env.ADMIN_SESSION_SECRET,
      hasDbUrl: !!process.env.DATABASE_URL,
    }
  })
}
