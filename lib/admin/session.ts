/**
 * Admin Session Management
 * JWT-based sessions stored in httpOnly cookies
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'
import { neon } from '@neondatabase/serverless'

const SESSION_COOKIE_NAME = 'admin_session'
const SESSION_TTL = parseInt(process.env.ADMIN_SESSION_TTL || '86400', 10) // 24 hours default

interface AdminSessionPayload extends JWTPayload {
  adminId: number
  email: string
  role: string
  sessionId: number
}

export interface AdminSession {
  adminId: number
  email: string
  role: string
  sessionId: number
  firstName?: string
  lastName?: string
  avatarUrl?: string
}

function getSecretKey(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET is not set')
  }
  return new TextEncoder().encode(secret)
}

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

/**
 * Create a new admin session
 */
export async function createSession(
  adminId: number,
  email: string,
  role: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const sql = getSql()
  const expiresAt = new Date(Date.now() + SESSION_TTL * 1000)

  // Generate unique session token
  const sessionToken = crypto.randomUUID()

  // Store session in database
  const [session] = await sql`
    INSERT INTO admin_sessions (admin_id, session_token, ip_address, user_agent, expires_at)
    VALUES (${adminId}, ${sessionToken}, ${ipAddress || null}, ${userAgent || null}, ${expiresAt.toISOString()})
    RETURNING id
  `

  // Create JWT
  const token = await new SignJWT({
    adminId,
    email,
    role,
    sessionId: session.id
  } as AdminSessionPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecretKey())

  // Update last login
  await sql`
    UPDATE admin_users SET last_login_at = NOW() WHERE id = ${adminId}
  `

  return token
}

/**
 * Verify and decode session token
 */
export async function verifySession(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    const sessionPayload = payload as AdminSessionPayload

    // Verify session exists in database and not expired
    const sql = getSql()
    const [session] = await sql`
      SELECT s.id, s.expires_at, u.email, u.role, u.first_name, u.last_name, u.avatar_url, u.is_active
      FROM admin_sessions s
      JOIN admin_users u ON s.admin_id = u.id
      WHERE s.id = ${sessionPayload.sessionId}
      AND s.expires_at > NOW()
      AND u.is_active = true
    `

    if (!session) {
      return null
    }

    return {
      adminId: sessionPayload.adminId,
      email: sessionPayload.email,
      role: sessionPayload.role,
      sessionId: sessionPayload.sessionId,
      firstName: session.first_name,
      lastName: session.last_name,
      avatarUrl: session.avatar_url
    }
  } catch {
    return null
  }
}

/**
 * Get current session from cookies
 *
 * TESTING MODE: Returns test session when ADMIN_AUTH_DISABLED=true
 */
export async function getCurrentSession(): Promise<AdminSession | null> {
  // TEMPORARY: Disable auth for testing (ONLY in development!)
  if (process.env.ADMIN_AUTH_DISABLED === 'true') {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SECURITY] ADMIN_AUTH_DISABLED is set in production! Ignoring.')
      // Continue to normal auth flow below
    } else {
      return {
        adminId: 1,
        email: 'test@admin.local',
        role: 'super_admin',
        sessionId: 1,
        firstName: 'Test',
        lastName: 'Admin'
      }
    }
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  return verifySession(token)
}

/**
 * Set session cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
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
export async function deleteSession(sessionId: number): Promise<void> {
  const sql = getSql()
  await sql`
    DELETE FROM admin_sessions WHERE id = ${sessionId}
  `
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Clean up expired sessions (run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const sql = getSql()
  const result = await sql`
    DELETE FROM admin_sessions WHERE expires_at < NOW()
  `
  return result.length
}
