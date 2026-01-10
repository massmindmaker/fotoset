/**
 * POST /api/admin/auth/login
 * Email/Password login endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, findAdminByEmail, createAdmin, getSuperAdminEmail } from '@/lib/admin/auth'
import { createSession, setSessionCookie } from '@/lib/admin/session'
import { logAdminAction } from '@/lib/admin/audit'
import { checkRateLimit, recordLoginAttempt, getClientIP } from '@/lib/admin/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ipAddress = getClientIP(request)

    // Check rate limit BEFORE processing request
    const rateLimit = await checkRateLimit(ipAddress)
    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      return NextResponse.json(
        {
          error: rateLimit.blocked
            ? 'Too many failed attempts. Please try again later.'
            : 'Too many requests. Please slow down.',
          retryAfter,
          blockedUntil: rateLimit.resetAt.toISOString()
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) }
        }
      )
    }

    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }
    const userAgent = request.headers.get('user-agent') || undefined

    // Check if this is the super admin email and no admin exists yet
    const superEmail = getSuperAdminEmail()
    const existingAdmin = await findAdminByEmail(email)

    if (!existingAdmin && superEmail && email.toLowerCase() === superEmail.toLowerCase()) {
      // Auto-create super admin on first login
      const newAdmin = await createAdmin({
        email: email.toLowerCase(),
        password,
        role: 'super_admin'
      })

      // Create session
      const token = await createSession(
        newAdmin.id,
        newAdmin.email,
        newAdmin.role,
        ipAddress,
        userAgent
      )

      await setSessionCookie(token)

      // Record successful login (clears rate limit)
      await recordLoginAttempt(ipAddress, email.toLowerCase(), true)

      // Log successful login
      await logAdminAction({
        adminId: newAdmin.id,
        action: 'login',
        metadata: { method: 'email', firstLogin: true },
        ipAddress
      })

      return NextResponse.json({
        success: true,
        admin: {
          id: newAdmin.id,
          email: newAdmin.email,
          role: newAdmin.role,
          firstName: newAdmin.firstName,
          lastName: newAdmin.lastName
        }
      })
    }

    // Verify password
    const admin = await verifyPassword(email, password)

    if (!admin) {
      // Record failed login attempt for rate limiting
      await recordLoginAttempt(ipAddress, email, false)

      // Log failed login attempt
      if (existingAdmin) {
        await logAdminAction({
          adminId: existingAdmin.id,
          action: 'login_failed',
          metadata: { reason: 'invalid_password' },
          ipAddress
        })
      }

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Create session
    const token = await createSession(
      admin.id,
      admin.email,
      admin.role,
      ipAddress,
      userAgent
    )

    await setSessionCookie(token)

    // Record successful login (clears rate limit)
    await recordLoginAttempt(ipAddress, email, true)

    // Log successful login
    await logAdminAction({
      adminId: admin.id,
      action: 'login',
      metadata: { method: 'email' },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        firstName: admin.firstName,
        lastName: admin.lastName,
        avatarUrl: admin.avatarUrl
      }
    })
  } catch (error) {
    console.error('[Admin Login] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
