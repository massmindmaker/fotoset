// Minimal test endpoint to debug Node.js runtime issue
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    ok: true,
    runtime: 'nodejs',
    time: new Date().toISOString()
  })
}
