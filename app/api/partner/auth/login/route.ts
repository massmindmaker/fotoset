import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { createPartnerSession, setPartnerSessionCookie } from '@/lib/partner/session'
import { checkRateLimit, recordLoginAttempt, getClientIP } from '@/lib/admin/rate-limit'

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)

  try {
    const body = await request.json()
    const { email, password } = body

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email и пароль обязательны' },
        { status: 400 }
      )
    }

    // Rate limiting (reuse admin infrastructure)
    const rateLimitResult = await checkRateLimit(ip)
    if (!rateLimitResult.allowed) {
      const retryAfter = Math.ceil(
        (rateLimitResult.resetAt.getTime() - Date.now()) / 1000
      )
      return NextResponse.json(
        {
          success: false,
          error: `Слишком много попыток входа. Повторите через ${Math.ceil(retryAfter / 60)} мин.`
        },
        { status: 429 }
      )
    }

    // Find partner by email
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
      WHERE LOWER(pu.email) = ${email.toLowerCase().trim()}
        AND pu.is_active = TRUE
    `

    if (partners.length === 0) {
      // Record failed attempt
      await recordLoginAttempt(ip, email, false)
      return NextResponse.json(
        { success: false, error: 'Неверный email или пароль' },
        { status: 401 }
      )
    }

    const partner = partners[0]

    // Check if user is still a partner
    if (!partner.is_partner) {
      await recordLoginAttempt(ip, email, false)
      return NextResponse.json(
        { success: false, error: 'Ваш партнёрский статус отозван' },
        { status: 403 }
      )
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, partner.password_hash)
    if (!isValidPassword) {
      await recordLoginAttempt(ip, email, false)
      return NextResponse.json(
        { success: false, error: 'Неверный email или пароль' },
        { status: 401 }
      )
    }

    // Create session
    const userAgent = request.headers.get('user-agent') || undefined
    const token = await createPartnerSession(
      partner.id,
      partner.user_id,
      partner.email,
      ip,
      userAgent
    )

    // Record successful login
    await recordLoginAttempt(ip, email, true)

    // Build response
    const response = NextResponse.json({
      success: true,
      partner: {
        id: partner.id,
        userId: partner.user_id,
        email: partner.email,
        firstName: partner.first_name,
        lastName: partner.last_name,
        commissionRate: partner.commission_rate
      }
    })

    // Set httpOnly cookie
    response.cookies.set('partner_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    })

    return response
  } catch (error) {
    console.error('[Partner Auth] Login error:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
