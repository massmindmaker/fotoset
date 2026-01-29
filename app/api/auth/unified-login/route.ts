/**
 * POST /api/auth/unified-login
 *
 * Unified login endpoint for both Admin and Partner users.
 * Checks admin_users first, then partner_users.
 * Returns user type and sets appropriate session cookie.
 */

// NOTE: Must use Node.js runtime because bcryptjs doesn't work correctly in Edge runtime
// bcrypt.compare() always returns false in Edge environment
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30 // Increase timeout to 30s for Node.js

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { createSession, setSessionCookie as setAdminSessionCookie } from '@/lib/admin/session'
import { createPartnerSession, setPartnerSessionCookie } from '@/lib/partner/session'
import { checkRateLimit, recordLoginAttempt, getClientIP } from '@/lib/admin/rate-limit'
import { logAdminAction } from '@/lib/admin/audit'

export type UserType = 'admin' | 'partner'

interface UnifiedLoginResponse {
  success: boolean
  userType?: UserType
  redirect?: string
  user?: {
    id: number
    email: string
    firstName?: string
    lastName?: string
    role?: string           // For admin
    commissionRate?: number // For partner
  }
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<UnifiedLoginResponse>> {
  const ip = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || undefined
  console.log('[UnifiedLogin] Request from IP:', ip, 'UserAgent:', userAgent?.substring(0, 50))

  try {
    // Rate limiting
    console.log('[UnifiedLogin] Checking rate limit...')
    const rateLimitResult = await checkRateLimit(ip)
    console.log('[UnifiedLogin] Rate limit result:', JSON.stringify(rateLimitResult))
    if (!rateLimitResult.allowed) {
      const retryAfter = Math.ceil(
        (rateLimitResult.resetAt.getTime() - Date.now()) / 1000
      )
      return NextResponse.json(
        {
          success: false,
          error: rateLimitResult.blocked
            ? `Слишком много попыток. Повторите через ${Math.ceil(retryAfter / 60)} мин.`
            : 'Слишком много запросов. Подождите немного.'
        },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    // Parse request body
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email и пароль обязательны' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // ============================================================
    // Step 1: Check admin_users table
    // ============================================================
    const admins = await sql`
      SELECT id, email, password_hash, role, first_name, last_name, is_active
      FROM admin_users
      WHERE LOWER(email) = ${normalizedEmail}
    `

    if (admins.length > 0) {
      const admin = admins[0]

      // Check if admin is active
      if (!admin.is_active) {
        await recordLoginAttempt(ip, normalizedEmail, false)
        return NextResponse.json(
          { success: false, error: 'Аккаунт деактивирован' },
          { status: 403 }
        )
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, admin.password_hash)
      if (!isValidPassword) {
        await recordLoginAttempt(ip, normalizedEmail, false)
        return NextResponse.json(
          { success: false, error: 'Неверный email или пароль' },
          { status: 401 }
        )
      }

      // Create admin session
      const token = await createSession(
        admin.id,
        admin.email,
        admin.role,
        ip,
        userAgent
      )

      // Record successful login
      await recordLoginAttempt(ip, normalizedEmail, true)

      // Log admin action
      await logAdminAction({
        adminId: admin.id,
        action: 'login',
        metadata: { method: 'unified_login' },
        ipAddress: ip
      })

      // Set cookie and return response
      const response = NextResponse.json({
        success: true,
        userType: 'admin' as UserType,
        redirect: '/admin',
        user: {
          id: admin.id,
          email: admin.email,
          firstName: admin.first_name,
          lastName: admin.last_name,
          role: admin.role
        }
      })

      // Set admin session cookie
      response.cookies.set('admin_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/'
      })

      return response
    }

    // ============================================================
    // Step 2: Check partner_users table
    // ============================================================
    const partners = await sql`
      SELECT
        pu.id,
        pu.user_id,
        pu.email,
        pu.password_hash,
        pu.first_name,
        pu.last_name,
        pu.is_active,
        rb.is_partner,
        rb.commission_rate
      FROM partner_users pu
      JOIN referral_balances rb ON pu.user_id = rb.user_id
      WHERE LOWER(pu.email) = ${normalizedEmail}
    `

    if (partners.length > 0) {
      const partner = partners[0]

      // Check if partner is active
      if (!partner.is_active) {
        await recordLoginAttempt(ip, normalizedEmail, false)
        return NextResponse.json(
          { success: false, error: 'Аккаунт деактивирован' },
          { status: 403 }
        )
      }

      // Check if still a partner
      if (!partner.is_partner) {
        await recordLoginAttempt(ip, normalizedEmail, false)
        return NextResponse.json(
          { success: false, error: 'Партнёрский статус отозван' },
          { status: 403 }
        )
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, partner.password_hash)
      if (!isValidPassword) {
        await recordLoginAttempt(ip, normalizedEmail, false)
        return NextResponse.json(
          { success: false, error: 'Неверный email или пароль' },
          { status: 401 }
        )
      }

      // Create partner session (positional args: partnerId, userId, email, ip, userAgent)
      const token = await createPartnerSession(
        partner.id,
        partner.user_id,
        partner.email,
        ip,
        userAgent
      )

      // Record successful login
      await recordLoginAttempt(ip, normalizedEmail, true)

      // Update last_login_at
      await sql`
        UPDATE partner_users
        SET last_login_at = NOW()
        WHERE id = ${partner.id}
      `

      // Set cookie and return response
      const response = NextResponse.json({
        success: true,
        userType: 'partner' as UserType,
        redirect: '/partner/dashboard',
        user: {
          id: partner.id,
          userId: partner.user_id, // User ID for localStorage (needed by partner hooks)
          email: partner.email,
          firstName: partner.first_name,
          lastName: partner.last_name,
          commissionRate: Number(partner.commission_rate)
        }
      })

      // Set partner session cookie
      response.cookies.set('partner_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/'
      })

      return response
    }

    // ============================================================
    // Step 3: No user found
    // ============================================================
    await recordLoginAttempt(ip, normalizedEmail, false)
    return NextResponse.json(
      { success: false, error: 'Неверный email или пароль' },
      { status: 401 }
    )

  } catch (error) {
    console.error('[Unified Login] Error:', error)
    // Temporary detailed error for debugging - REMOVE IN PRODUCTION
    const errorDetails = error instanceof Error
      ? { message: error.message, stack: error.stack?.split('\n').slice(0, 3).join(' | ') }
      : String(error)
    return NextResponse.json(
      { success: false, error: 'Ошибка сервера', debug: errorDetails },
      { status: 500 }
    )
  }
}
