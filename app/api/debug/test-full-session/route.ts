/**
 * Test full session creation (INSERT + JWT)
 * Uses Node.js runtime like unified-login
 * DELETE AFTER DEBUGGING
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { SignJWT } from 'jose'

export async function GET() {
  const results: Record<string, unknown> = {}

  try {
    // Step 1: Check secret
    const secret = process.env.ADMIN_SESSION_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'ADMIN_SESSION_SECRET not set' })
    }
    results.step1_secret = { exists: true, length: secret.length }

    // Step 2: Generate test data
    const adminId = 1
    const email = 'test@test.com'
    const role = 'admin'
    const sessionToken = crypto.randomUUID()
    const ipAddress = '127.0.0.1'
    const userAgent = 'TestAgent/1.0'
    const expiresAt = new Date(Date.now() + 86400 * 1000)

    results.step2_data = {
      adminId,
      email,
      sessionToken: sessionToken.substring(0, 20) + '...',
      expiresAt: expiresAt.toISOString()
    }

    // Step 3: INSERT into database
    let sessionId: number
    try {
      const [session] = await sql`
        INSERT INTO admin_sessions (admin_id, session_token, ip_address, user_agent, expires_at)
        VALUES (${adminId}, ${sessionToken}, ${ipAddress}, ${userAgent}, ${expiresAt.toISOString()})
        RETURNING id
      `
      sessionId = session.id
      results.step3_insert = { success: true, sessionId }
    } catch (insertError) {
      results.step3_insert = {
        success: false,
        error: insertError instanceof Error ? insertError.message : String(insertError)
      }
      return NextResponse.json(results)
    }

    // Step 4: Create JWT
    try {
      const secretKey = new TextEncoder().encode(secret)

      const token = await new SignJWT({
        adminId,
        email,
        role,
        sessionId
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresAt)
        .sign(secretKey)

      results.step4_jwt = {
        success: true,
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 50) + '...'
      }
    } catch (jwtError) {
      results.step4_jwt = {
        success: false,
        error: jwtError instanceof Error ? jwtError.message : String(jwtError),
        stack: jwtError instanceof Error ? jwtError.stack?.split('\n').slice(0, 3) : undefined
      }
    }

    // Cleanup
    await sql`DELETE FROM admin_sessions WHERE id = ${sessionId}`
    results.step5_cleanup = { success: true }

    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json({
      ...results,
      outerError: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined
      }
    })
  }
}
