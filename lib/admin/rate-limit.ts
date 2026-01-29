/**
 * Database-based Rate Limiting for Admin Login
 *
 * Limits: 5 attempts per 15 minutes per IP
 * Block: After 5 failed attempts, block for 1 hour
 */

import { sql } from '@/lib/db'

// Rate limit configuration
const MAX_ATTEMPTS = 5
const WINDOW_MINUTES = 15
const BLOCK_MINUTES = 60

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  blocked: boolean
}

/**
 * Check if an IP address is rate limited
 */
export async function checkRateLimit(ipAddress: string): Promise<RateLimitResult> {
  console.log('[RateLimit] Checking for IP:', ipAddress)

  const now = new Date()
  const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000)
  const blockStart = new Date(now.getTime() - BLOCK_MINUTES * 60 * 1000)

  // Ensure table exists (safe for first run)
  await ensureTableExists()
  console.log('[RateLimit] Table ensured')

  // Count failed attempts in the block window (for blocked check)
  const blockedCount = await sql`
    SELECT COUNT(*) as count
    FROM login_attempts
    WHERE ip_address = ${ipAddress}
      AND success = FALSE
      AND attempted_at > ${blockStart}
  `.then((rows: any[]) => parseInt(rows[0]?.count || '0'))
  console.log('[RateLimit] blockedCount:', blockedCount, 'for IP:', ipAddress)

  // If 5+ failed attempts in last hour, they're blocked
  if (blockedCount >= MAX_ATTEMPTS) {
    // Find when the oldest counted attempt expires
    const oldestAttempt = await sql`
      SELECT attempted_at
      FROM login_attempts
      WHERE ip_address = ${ipAddress}
        AND success = FALSE
        AND attempted_at > ${blockStart}
      ORDER BY attempted_at ASC
      LIMIT 1
    `.then((rows: any[]) => rows[0]?.attempted_at)

    const resetAt = oldestAttempt
      ? new Date(new Date(oldestAttempt).getTime() + BLOCK_MINUTES * 60 * 1000)
      : new Date(now.getTime() + BLOCK_MINUTES * 60 * 1000)

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      blocked: true,
    }
  }

  // Count attempts in the rate limit window
  const windowCount = await sql`
    SELECT COUNT(*) as count
    FROM login_attempts
    WHERE ip_address = ${ipAddress}
      AND attempted_at > ${windowStart}
  `.then((rows: any[]) => parseInt(rows[0]?.count || '0'))
  console.log('[RateLimit] windowCount:', windowCount, 'MAX_ATTEMPTS:', MAX_ATTEMPTS, 'allowed:', windowCount < MAX_ATTEMPTS)

  const remaining = Math.max(0, MAX_ATTEMPTS - windowCount)
  const resetAt = new Date(now.getTime() + WINDOW_MINUTES * 60 * 1000)

  const result = {
    allowed: windowCount < MAX_ATTEMPTS,
    remaining,
    resetAt,
    blocked: false,
  }
  console.log('[RateLimit] Final result:', JSON.stringify(result))
  return result
}

/**
 * Record a login attempt
 */
export async function recordLoginAttempt(
  ipAddress: string,
  email: string | null,
  success: boolean
): Promise<void> {
  await ensureTableExists()

  await sql`
    INSERT INTO login_attempts (ip_address, email, success, attempted_at)
    VALUES (${ipAddress}, ${email}, ${success}, NOW())
  `

  // If successful, clear previous failed attempts for this IP
  // This resets the rate limit on successful login
  if (success) {
    await sql`
      DELETE FROM login_attempts
      WHERE ip_address = ${ipAddress}
        AND success = FALSE
    `
  }
}

/**
 * Clear old login attempts (for cleanup cron)
 */
export async function cleanupOldAttempts(): Promise<number> {
  await ensureTableExists()

  const result = await sql`
    DELETE FROM login_attempts
    WHERE attempted_at < NOW() - INTERVAL '24 hours'
  `
  return result.length
}

/**
 * Get IP address from request headers
 * Vercel: x-forwarded-for or x-real-ip
 */
export function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first (client IP)
    return forwardedFor.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  // Fallback for local development
  return '127.0.0.1'
}

/**
 * Ensure the login_attempts table exists
 */
async function ensureTableExists(): Promise<void> {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id SERIAL PRIMARY KEY,
        ip_address VARCHAR(45) NOT NULL,
        email VARCHAR(255),
        success BOOLEAN NOT NULL DEFAULT FALSE,
        attempted_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `
  } catch (e) {
    // Table likely already exists, ignore
  }
}
