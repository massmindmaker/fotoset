// Minimal Node.js runtime test - no imports except NextResponse
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    ok: true,
    runtime: 'nodejs',
    time: new Date().toISOString()
  })
}
