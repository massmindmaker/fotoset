/**
 * DEBUG ONLY: Bypass rate limit for login testing
 * REMOVE AFTER TESTING
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { createSession } from '@/lib/admin/session'
import { createPartnerSession } from '@/lib/partner/session'

export async function POST(request: NextRequest) {
  // Security: Only allow on test subdomain
  if (!request.url.includes('test.pinglass.ru') && !request.url.includes('localhost')) {
    return NextResponse.json({ error: 'Only allowed on test environment' }, { status: 403 })
  }

  try {
    const { email, password, type } = await request.json()
    const normalizedEmail = email.toLowerCase().trim()

    console.log('[BypassLogin] Attempting login for:', normalizedEmail, 'type:', type)

    if (type === 'admin' || !type) {
      // Try admin first
      const admins = await sql`
        SELECT id, email, password_hash, role, first_name, last_name, is_active
        FROM admin_users
        WHERE LOWER(email) = ${normalizedEmail}
      `

      if (admins.length > 0) {
        const admin = admins[0]
        console.log('[BypassLogin] Found admin:', admin.email, 'active:', admin.is_active)

        if (!admin.is_active) {
          return NextResponse.json({ success: false, error: 'Admin inactive' })
        }

        const isValid = await bcrypt.compare(password, admin.password_hash)
        console.log('[BypassLogin] Password valid:', isValid)

        if (!isValid) {
          return NextResponse.json({
            success: false,
            error: 'Invalid password',
            debug: {
              hashPrefix: admin.password_hash.substring(0, 20),
              providedPassword: password.length + ' chars'
            }
          })
        }

        // Create session
        const token = await createSession(admin.id, admin.email, admin.role)

        const response = NextResponse.json({
          success: true,
          userType: 'admin',
          redirect: '/admin',
          user: { id: admin.id, email: admin.email, role: admin.role }
        })

        response.cookies.set('admin_session', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24,
          path: '/'
        })

        return response
      }
    }

    if (type === 'partner' || !type) {
      // Try partner
      const partners = await sql`
        SELECT
          pu.id, pu.user_id, pu.email, pu.password_hash, pu.is_active,
          rb.is_partner, rb.commission_rate
        FROM partner_users pu
        LEFT JOIN referral_balances rb ON pu.user_id = rb.user_id
        WHERE LOWER(pu.email) = ${normalizedEmail}
      `

      if (partners.length > 0) {
        const partner = partners[0]
        console.log('[BypassLogin] Found partner:', partner.email, 'active:', partner.is_active, 'is_partner:', partner.is_partner)

        if (!partner.is_active) {
          return NextResponse.json({ success: false, error: 'Partner inactive' })
        }

        if (!partner.is_partner) {
          return NextResponse.json({ success: false, error: 'Not a partner (is_partner=false)' })
        }

        const isValid = await bcrypt.compare(password, partner.password_hash)
        console.log('[BypassLogin] Password valid:', isValid)

        if (!isValid) {
          return NextResponse.json({
            success: false,
            error: 'Invalid password',
            debug: {
              hashPrefix: partner.password_hash.substring(0, 20),
              providedPassword: password.length + ' chars'
            }
          })
        }

        // Create session
        const token = await createPartnerSession(partner.id, partner.user_id, partner.email)

        const response = NextResponse.json({
          success: true,
          userType: 'partner',
          redirect: '/partner/dashboard',
          user: { id: partner.id, email: partner.email }
        })

        response.cookies.set('partner_session', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/'
        })

        return response
      }
    }

    return NextResponse.json({ success: false, error: 'User not found' })

  } catch (error) {
    console.error('[BypassLogin] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
