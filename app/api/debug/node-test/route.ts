// Diagnostic endpoint to test Node.js runtime step by step
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
// Explicitly Node.js runtime (default)

export async function GET() {
  const steps: { step: string; time: number; ok: boolean; error?: string }[] = []
  const start = Date.now()

  // Step 1: Basic response
  steps.push({ step: 'basic', time: Date.now() - start, ok: true })

  // Step 2: Import sql
  try {
    const { sql } = await import('@/lib/db')
    steps.push({ step: 'import_sql', time: Date.now() - start, ok: true })
    
    // Step 3: Query database
    try {
      const result = await sql`SELECT 1 as test`
      steps.push({ step: 'db_query', time: Date.now() - start, ok: true })
    } catch (e) {
      steps.push({ step: 'db_query', time: Date.now() - start, ok: false, error: String(e) })
    }
  } catch (e) {
    steps.push({ step: 'import_sql', time: Date.now() - start, ok: false, error: String(e) })
  }

  // Step 4: Import logger
  try {
    const { createLogger } = await import('@/lib/api-utils')
    steps.push({ step: 'import_logger', time: Date.now() - start, ok: true })
  } catch (e) {
    steps.push({ step: 'import_logger', time: Date.now() - start, ok: false, error: String(e) })
  }

  // Step 5: Import auth-middleware
  try {
    const { getAuthenticatedUser } = await import('@/lib/auth-middleware')
    steps.push({ step: 'import_auth', time: Date.now() - start, ok: true })
  } catch (e) {
    steps.push({ step: 'import_auth', time: Date.now() - start, ok: false, error: String(e) })
  }

  return NextResponse.json({
    runtime: 'nodejs',
    totalTime: Date.now() - start,
    steps
  })
}
