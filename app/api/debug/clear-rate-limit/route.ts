/**
 * Clear rate limit (login_attempts) - Edge runtime for speed
 * DELETE AFTER DEBUGGING
 */
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Delete all login attempts
    const deleted = await sql`
      DELETE FROM login_attempts
      WHERE attempted_at > NOW() - INTERVAL '2 hours'
      RETURNING id
    `

    // Also show current admin users
    const admins = await sql`
      SELECT id, email, LEFT(password_hash, 25) as hash_prefix
      FROM admin_users
      ORDER BY id
    `

    return NextResponse.json({
      success: true,
      deletedAttempts: deleted.length,
      admins: admins.map((a: Record<string, unknown>) => ({
        id: a.id,
        email: a.email,
        hashPrefix: a.hash_prefix
      }))
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
