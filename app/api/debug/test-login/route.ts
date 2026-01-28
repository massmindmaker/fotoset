/**
 * Debug endpoint to test login components step by step
 * REMOVE AFTER DEBUGGING
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    steps: []
  }

  try {
    const body = await request.json()
    const { email, password, secret } = body

    if (secret !== 'debug-login-2026') {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 403 })
    }

    // Step 1: Check env vars
    results.steps.push({
      step: 1,
      name: 'Check env vars',
      DATABASE_URL: !!process.env.DATABASE_URL,
      ADMIN_SESSION_SECRET: !!process.env.ADMIN_SESSION_SECRET,
      PARTNER_SESSION_SECRET: !!process.env.PARTNER_SESSION_SECRET
    })

    // Step 2: Test DB connection
    try {
      const dbTest = await sql`SELECT 1 as test`
      results.steps.push({
        step: 2,
        name: 'DB connection',
        success: true,
        result: dbTest[0]
      })
    } catch (dbError) {
      results.steps.push({
        step: 2,
        name: 'DB connection',
        success: false,
        error: dbError instanceof Error ? dbError.message : String(dbError)
      })
      return NextResponse.json(results)
    }

    // Step 3: Query admin_users
    try {
      const normalizedEmail = email.toLowerCase().trim()
      const admins = await sql`
        SELECT id, email, password_hash, role, first_name, last_name, is_active
        FROM admin_users
        WHERE LOWER(email) = ${normalizedEmail}
      `
      results.steps.push({
        step: 3,
        name: 'Query admin_users',
        success: true,
        found: admins.length > 0,
        email: normalizedEmail
      })

      if (admins.length > 0) {
        const admin = admins[0]

        // Step 4: Verify password
        try {
          const isValid = await bcrypt.compare(password, admin.password_hash)
          results.steps.push({
            step: 4,
            name: 'Password verify',
            success: true,
            isValid,
            adminId: admin.id,
            isActive: admin.is_active
          })
        } catch (bcryptError) {
          results.steps.push({
            step: 4,
            name: 'Password verify',
            success: false,
            error: bcryptError instanceof Error ? bcryptError.message : String(bcryptError)
          })
        }

        // Step 5: Try to create session
        try {
          const { createSession } = await import('@/lib/admin/session')
          results.steps.push({
            step: 5,
            name: 'Import createSession',
            success: true
          })

          // Step 6: Actually create session
          const token = await createSession(
            admin.id,
            admin.email,
            admin.role,
            '127.0.0.1',
            'debug-test'
          )
          results.steps.push({
            step: 6,
            name: 'Create session',
            success: true,
            tokenLength: token.length
          })
        } catch (sessionError) {
          results.steps.push({
            step: 5,
            name: 'Session creation',
            success: false,
            error: sessionError instanceof Error ? sessionError.message : String(sessionError),
            stack: sessionError instanceof Error ? sessionError.stack?.split('\n').slice(0, 5) : undefined
          })
        }
      }
    } catch (queryError) {
      results.steps.push({
        step: 3,
        name: 'Query admin_users',
        success: false,
        error: queryError instanceof Error ? queryError.message : String(queryError)
      })
    }

    return NextResponse.json(results)
  } catch (error) {
    results.error = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined
    }
    return NextResponse.json(results, { status: 500 })
  }
}
