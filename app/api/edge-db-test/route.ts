/**
 * Minimal Edge test endpoint to isolate DB vs other issues
 * Tests: Edge runtime + Database connection
 */

import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const runtime = 'edge'

export async function GET() {
  const startTime = Date.now()
  
  try {
    // Simple DB query
    const result = await sql`SELECT 1 as test, NOW() as time`
    
    return NextResponse.json({
      status: "ok",
      runtime: "edge",
      db: "connected",
      result: result[0],
      responseTime: Date.now() - startTime,
    })
  } catch (error) {
    return NextResponse.json({
      status: "error",
      runtime: "edge",
      db: "failed",
      error: error instanceof Error ? error.message : "Unknown",
      responseTime: Date.now() - startTime,
    }, { status: 500 })
  }
}
