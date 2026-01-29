/**
 * GET/PUT /api/admin/settings/tbank
 * T-Bank settings management
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
const DEFAULT_SETTINGS = {
  mode: 'test',
  testTerminalKey: '',
  testPassword: '',
  prodTerminalKey: '',
  prodPassword: ''
}

export async function GET() {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Check if admin_settings table exists and has tbank_mode
    const [setting] = await sql`
      SELECT value FROM admin_settings WHERE key = 'tbank_mode'
    `.catch(() => [null])

    if (setting?.value) {
      return NextResponse.json({ settings: setting.value })
    }

    // Return defaults if not set, but mask env vars
    const envSettings = {
      mode: process.env.TBANK_MODE || 'test',
      testTerminalKey: process.env.TBANK_TEST_TERMINAL_KEY ? '****' + process.env.TBANK_TEST_TERMINAL_KEY.slice(-4) : '',
      testPassword: process.env.TBANK_TEST_PASSWORD ? '********' : '',
      prodTerminalKey: process.env.TBANK_TERMINAL_KEY ? '****' + process.env.TBANK_TERMINAL_KEY.slice(-4) : '',
      prodPassword: process.env.TBANK_PASSWORD ? '********' : ''
    }

    return NextResponse.json({ settings: envSettings })
  } catch (error) {
    console.error('[Admin Settings T-Bank] GET Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch T-Bank settings' },
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

    const body = await request.json()
    const { settings } = body

    if (!settings || !settings.mode) {
      return NextResponse.json(
        { error: 'Settings object with mode is required' },
        { status: 400 }
      )
    }

    if (!['test', 'production'].includes(settings.mode)) {
      return NextResponse.json(
        { error: 'Mode must be "test" or "production"' },
        { status: 400 }
      )
    }
    // Upsert the setting
    await sql`
      INSERT INTO admin_settings (key, value, updated_at)
      VALUES ('tbank_mode', ${JSON.stringify(settings)}::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = ${JSON.stringify(settings)}::jsonb, updated_at = NOW()
    `

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('[Admin Settings T-Bank] PUT Error:', error)
    return NextResponse.json(
      { error: 'Failed to save T-Bank settings' },
      { status: 500 }
    )
  }
}
