/**
 * GET /api/admin/settings
 * Get all admin settings
 */

import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

export async function GET() {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = getSql()

    const settings = await sql`
      SELECT key, value, updated_at
      FROM admin_settings
    `

    const settingsMap = settings.reduce((acc: Record<string, unknown>, s) => {
      acc[s.key] = s.value
      return acc
    }, {})

    return NextResponse.json({
      settings: settingsMap,
      updatedAt: settings[0]?.updated_at
    })
  } catch (error) {
    console.error('[Admin Settings] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}
