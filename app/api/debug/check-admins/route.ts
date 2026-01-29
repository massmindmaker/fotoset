/**
 * Temporary debug endpoint to check admin users
 * DELETE AFTER DEBUGGING
 */
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const admins = await sql`
      SELECT id, email, role, is_active,
             LEFT(password_hash, 10) as hash_prefix,
             created_at
      FROM admin_users
      ORDER BY id
      LIMIT 10
    `

    return NextResponse.json({
      success: true,
      count: admins.length,
      admins: admins.map((a: Record<string, unknown>) => ({
        id: a.id,
        email: a.email,
        role: a.role,
        isActive: a.is_active,
        hashPrefix: a.hash_prefix,
        createdAt: a.created_at
      }))
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
