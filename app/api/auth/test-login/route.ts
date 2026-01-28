/**
 * Test endpoint to diagnose unified-login issues
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  const steps: string[] = []

  try {
    // Step 1: Parse body
    steps.push('parsing body')
    const body = await request.json()
    const { email, password } = body
    steps.push(`email: ${email}`)

    // Step 2: Query admin_users
    steps.push('querying admin_users')
    const normalizedEmail = email.toLowerCase().trim()
    const admins = await sql`
      SELECT id, email, password_hash, is_active
      FROM admin_users
      WHERE LOWER(email) = ${normalizedEmail}
    `
    steps.push(`found ${admins.length} admins`)

    if (admins.length === 0) {
      return NextResponse.json({ success: false, error: 'Admin not found', steps })
    }

    const admin = admins[0]
    steps.push(`admin id: ${admin.id}, active: ${admin.is_active}`)

    // Step 3: Verify password with bcryptjs (try both sync and async)
    steps.push('verifying password with bcryptjs')

    // Try sync version
    let isValidSync = false
    try {
      isValidSync = bcrypt.compareSync(password, admin.password_hash)
      steps.push(`sync compare: ${isValidSync}`)
    } catch (e) {
      steps.push(`sync error: ${e instanceof Error ? e.message : 'unknown'}`)
    }

    // Try async version
    let isValidAsync = false
    try {
      isValidAsync = await bcrypt.compare(password, admin.password_hash)
      steps.push(`async compare: ${isValidAsync}`)
    } catch (e) {
      steps.push(`async error: ${e instanceof Error ? e.message : 'unknown'}`)
    }

    const isValid = isValidSync || isValidAsync
    steps.push(`final result: ${isValid}`)

    return NextResponse.json({
      success: isValid,
      steps,
      admin: { id: admin.id, email: admin.email, is_active: admin.is_active }
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      steps
    }, { status: 500 })
  }
}
