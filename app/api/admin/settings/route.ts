/**
 * GET/PUT /api/admin/settings
 * Get and update admin settings
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
import { hasPermission } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'
export async function GET() {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const settings = await sql`
      SELECT key, value, updated_at
      FROM admin_settings
    `

    const settingsMap = settings.reduce((acc: Record<string, unknown>, s: any) => {
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

export async function PUT(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    if (!hasPermission(session.role as 'super_admin' | 'admin' | 'viewer', 'settings.edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { settings } = body

    // Validate settings
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return NextResponse.json({ error: 'Invalid settings data' }, { status: 400 })
    }
    // Update each setting individually
    for (const [key, value] of Object.entries(settings)) {
      await sql`
        INSERT INTO admin_settings (key, value, updated_by, updated_at)
        VALUES (${key}, ${JSON.stringify(value)}, ${session.adminId}, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = ${JSON.stringify(value)},
            updated_by = ${session.adminId},
            updated_at = NOW()
      `
    }

    // Audit log (non-blocking)
    try {
      await logAdminAction({
        adminId: session.adminId,
        action: 'settings_updated',
        targetType: 'setting',
        metadata: {
          newSettings: settings
        }
      })
    } catch (auditError) {
      console.error('[Admin Settings] Audit log failed:', auditError)
    }

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('[Admin Settings] PUT Error:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
