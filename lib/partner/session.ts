/**
 * Partner Session Management
 * JWT-based sessions stored in httpOnly cookies
 * Reuses admin infrastructure patterns for security
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'
import { sql } from '@/lib/db'

const SESSION_COOKIE_NAME = 'partner_session'
const SESSION_TTL = parseInt(process.env.PARTNER_SESSION_TTL || '604800', 10) // 7 days default

interface PartnerSessionPayload extends JWTPayload {
  partnerId: number
  userId: number
  email: string
  sessionId: number
}

export interface PartnerSession {
  partnerId: number
  userId: number
  email: string
  sessionId: number
  firstName?: string
  lastName?: string
  commissionRate?: number
}

function getSecretKey(): Uint8Array {
  // Use shared secret or dedicated partner secret
  const secret = process.env.PARTNER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET
  if (!secret) {
    console.error('[Partner Session] FATAL: Neither PARTNER_SESSION_SECRET nor ADMIN_SESSION_SECRET is set!')
    throw new Error('PARTNER_SESSION_SECRET or ADMIN_SESSION_SECRET is not set')
  }
  return new TextEncoder().encode(secret)
}

/**
 * Create a new partner session
 */
export async function createPartnerSession(
  partnerId: number,
  userId: number,
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  // Using shared sql connection from lib/db
  const expiresAt = new Date(Date.now() + SESSION_TTL * 1000)

  // Generate unique session token
  const sessionToken = crypto.randomUUID()

  // Store session in database
  const [session] = await sql`
    INSERT INTO partner_sessions (partner_id, session_token, ip_address, user_agent, expires_at)
    VALUES (${partnerId}, ${sessionToken}, ${ipAddress || null}, ${userAgent || null}, ${expiresAt.toISOString()})
    RETURNING id
  `

  // Create JWT
  const token = await new SignJWT({
    partnerId,
    userId,
    email,
    sessionId: session.id
  } as PartnerSessionPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecretKey())

  // Update last login
  await sql`
    UPDATE partner_users SET last_login_at = NOW() WHERE id = ${partnerId}
  `

  return token
}

/**
 * Verify and decode session token
 */
export async function verifyPartnerSession(token: string): Promise<PartnerSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    const sessionPayload = payload as PartnerSessionPayload

    // Verify session exists in database and not expired
    // Using shared sql connection from lib/db
    const sessions = await sql`
      SELECT
        s.id,
        s.expires_at,
        pu.email,
        pu.first_name,
        pu.last_name,
        pu.is_active,
        pu.user_id,
        rb.commission_rate
      FROM partner_sessions s
      JOIN partner_users pu ON s.partner_id = pu.id
      LEFT JOIN referral_balances rb ON pu.user_id = rb.user_id
      WHERE s.id = ${sessionPayload.sessionId}
      AND s.expires_at > NOW()
      AND pu.is_active = true
    `

    if (sessions.length === 0) {
      return null
    }

    const session = sessions[0]

    return {
      partnerId: sessionPayload.partnerId,
      userId: sessionPayload.userId,
      email: sessionPayload.email,
      sessionId: sessionPayload.sessionId,
      firstName: session.first_name,
      lastName: session.last_name,
      commissionRate: session.commission_rate
    }
  } catch {
    return null
  }
}

/**
 * Get current session from cookies
 */
export async function getCurrentPartnerSession(): Promise<PartnerSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  return verifyPartnerSession(token)
}

/**
 * Set session cookie
 */
export async function setPartnerSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL,
    path: '/'
  })
}

/**
 * Delete session (logout)
 */
export async function deletePartnerSession(sessionId: number): Promise<void> {
  // Using shared sql connection from lib/db
  await sql`
    DELETE FROM partner_sessions WHERE id = ${sessionId}
  `
}

/**
 * Clear session cookie
 */
export async function clearPartnerSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Clean up expired sessions (run periodically)
 */
export async function cleanupExpiredPartnerSessions(): Promise<number> {
  // Using shared sql connection from lib/db
  const result = await sql`
    DELETE FROM partner_sessions WHERE expires_at < NOW()
  `
  return result.length
}
