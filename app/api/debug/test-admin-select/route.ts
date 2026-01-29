/**
 * Test SELECT from admin_users (same query as unified-login)
 * Tests both Edge and Node.js patterns
 * DELETE AFTER DEBUGGING
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  console.log('[TestAdminSelect] Starting...')

  try {
    // Exact same query as unified-login
    console.log('[TestAdminSelect] Executing SELECT...')
    const admins = await sql`
      SELECT id, email, password_hash, role, first_name, last_name, is_active
      FROM admin_users
      WHERE LOWER(email) = 'massmindmaker@gmail.com'
    `

    console.log('[TestAdminSelect] Query done, rows:', admins.length)

    if (admins.length === 0) {
      return NextResponse.json({ error: 'Admin not found' })
    }

    const admin = admins[0]
    console.log('[TestAdminSelect] Admin:', admin.id, admin.email)

    // Return safe data (not full hash)
    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        hashLength: admin.password_hash?.length,
        hashPrefix: admin.password_hash?.substring(0, 30),
        role: admin.role,
        firstName: admin.first_name,
        lastName: admin.last_name,
        isActive: admin.is_active
      }
    })
  } catch (error) {
    console.error('[TestAdminSelect] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined
    })
  }
}
