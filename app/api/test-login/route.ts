/**
 * Simple test login endpoint - NO rate limit
 * For testing only - remove in production
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    const normalizedEmail = email.toLowerCase().trim()

    console.log('[TestLogin] Testing:', normalizedEmail)

    // Find admin
    const admins = await sql`
      SELECT id, email, password_hash, role, is_active
      FROM admin_users
      WHERE LOWER(email) = ${normalizedEmail}
    `

    if (admins.length > 0) {
      const admin = admins[0]
      console.log('[TestLogin] Found admin:', admin.email, 'active:', admin.is_active)
      console.log('[TestLogin] Hash prefix:', admin.password_hash.substring(0, 20))

      if (!admin.is_active) {
        return NextResponse.json({ success: false, error: 'Admin inactive' })
      }

      const isValid = await bcrypt.compare(password, admin.password_hash)
      console.log('[TestLogin] bcrypt.compare result:', isValid)

      if (isValid) {
        return NextResponse.json({
          success: true,
          type: 'admin',
          user: { id: admin.id, email: admin.email, role: admin.role }
        })
      } else {
        return NextResponse.json({
          success: false,
          error: 'Invalid password',
          debug: { hashPrefix: admin.password_hash.substring(0, 30) }
        })
      }
    }

    // Find partner
    const partners = await sql`
      SELECT pu.id, pu.email, pu.password_hash, pu.is_active, rb.is_partner
      FROM partner_users pu
      LEFT JOIN referral_balances rb ON pu.user_id = rb.user_id
      WHERE LOWER(pu.email) = ${normalizedEmail}
    `

    if (partners.length > 0) {
      const partner = partners[0]
      console.log('[TestLogin] Found partner:', partner.email, 'active:', partner.is_active, 'is_partner:', partner.is_partner)

      if (!partner.is_active) {
        return NextResponse.json({ success: false, error: 'Partner inactive' })
      }

      if (!partner.is_partner) {
        return NextResponse.json({ success: false, error: 'Not a partner' })
      }

      const isValid = await bcrypt.compare(password, partner.password_hash)
      console.log('[TestLogin] bcrypt.compare result:', isValid)

      if (isValid) {
        return NextResponse.json({
          success: true,
          type: 'partner',
          user: { id: partner.id, email: partner.email }
        })
      } else {
        return NextResponse.json({
          success: false,
          error: 'Invalid password',
          debug: { hashPrefix: partner.password_hash.substring(0, 30) }
        })
      }
    }

    return NextResponse.json({ success: false, error: 'User not found' })

  } catch (error) {
    console.error('[TestLogin] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
