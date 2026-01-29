/**
 * Set admin password hash directly (Edge runtime)
 * Uses pre-computed bcrypt hash since bcrypt doesn't work on Edge
 * DELETE AFTER DEBUGGING!
 */
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, passwordHash, secretKey } = body

    // Simple protection
    if (secretKey !== 'TEMP_DEBUG_KEY_2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!email || !passwordHash) {
      return NextResponse.json({ error: 'email and passwordHash required' }, { status: 400 })
    }

    // Validate hash format (must be bcrypt)
    if (!passwordHash.startsWith('$2b$') && !passwordHash.startsWith('$2a$')) {
      return NextResponse.json({ error: 'Invalid bcrypt hash format' }, { status: 400 })
    }

    // Update the hash directly
    const result = await sql`
      UPDATE admin_users
      SET password_hash = ${passwordHash}
      WHERE LOWER(email) = LOWER(${email})
      RETURNING id, email
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      updated: result[0],
      hashPrefix: passwordHash.substring(0, 25)
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
