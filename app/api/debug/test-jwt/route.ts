/**
 * Test JWT creation in Node.js runtime
 * DELETE AFTER DEBUGGING
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'

export async function GET() {
  console.log('[TestJWT] Starting...')

  try {
    const secret = process.env.ADMIN_SESSION_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'No secret' })
    }

    console.log('[TestJWT] Secret length:', secret.length)

    const secretKey = new TextEncoder().encode(secret)
    const expiresAt = new Date(Date.now() + 86400 * 1000)

    console.log('[TestJWT] Creating JWT...')
    const token = await new SignJWT({
      adminId: 1,
      email: 'test@test.com',
      role: 'admin',
      sessionId: 123
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(secretKey)

    console.log('[TestJWT] JWT created, length:', token.length)

    return NextResponse.json({
      success: true,
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 30) + '...'
    })
  } catch (error) {
    console.error('[TestJWT] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined
    })
  }
}
