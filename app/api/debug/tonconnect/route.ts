/**
 * Debug endpoint for TonConnect issues
 * POST /api/debug/tonconnect - log client-side events
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Log to server console for Vercel logs
    console.log('[TonConnect Debug]', JSON.stringify(data, null, 2))

    return NextResponse.json({ received: true, timestamp: Date.now() })
  } catch (error) {
    console.error('[TonConnect Debug] Error:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'TonConnect debug endpoint',
    timestamp: Date.now()
  })
}
