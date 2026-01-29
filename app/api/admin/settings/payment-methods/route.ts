/**
 * GET/PUT /api/admin/settings/payment-methods
 * Payment methods configuration (T-Bank, Telegram Stars, TON)
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
import { logAdminAction } from '@/lib/admin/audit'
import {
  PaymentMethodsSettings,
  DEFAULT_PAYMENT_METHODS
} from '@/lib/admin/types'
const SETTINGS_KEY = 'payment_methods'

/**
 * Validate TON wallet address (basic validation)
 */
function isValidTonAddress(address: string): boolean {
  if (!address) return false
  // TON addresses: EQ/UQ prefix + 48 chars base64
  // or raw format (64 hex chars)
  const eqPattern = /^(EQ|UQ)[A-Za-z0-9_-]{46}$/
  const rawPattern = /^[0-9a-fA-F]{64}$/
  return eqPattern.test(address) || rawPattern.test(address)
}

/**
 * Validate payment methods settings
 */
function validateSettings(settings: PaymentMethodsSettings): string | null {
  // At least one method must be enabled
  const enabledCount = [
    settings.tbank?.enabled,
    settings.stars?.enabled,
    settings.ton?.enabled
  ].filter(Boolean).length

  if (enabledCount === 0) {
    return 'At least one payment method must be enabled'
  }

  // Validate T-Bank settings
  if (settings.tbank) {
    if (typeof settings.tbank.commission !== 'number' ||
        settings.tbank.commission < 0 ||
        settings.tbank.commission > 100) {
      return 'T-Bank commission must be between 0 and 100'
    }
  }

  // Validate Stars settings
  if (settings.stars?.enabled) {
    const { pricing } = settings.stars
    if (!pricing ||
        typeof pricing.starter !== 'number' || pricing.starter <= 0 ||
        typeof pricing.standard !== 'number' || pricing.standard <= 0 ||
        typeof pricing.premium !== 'number' || pricing.premium <= 0) {
      return 'Stars pricing must have positive values for all tiers'
    }
  }

  // Validate TON settings
  if (settings.ton?.enabled) {
    if (!settings.ton.walletAddress || !isValidTonAddress(settings.ton.walletAddress)) {
      return 'Valid TON wallet address is required when TON is enabled'
    }
    const { pricing } = settings.ton
    if (!pricing ||
        typeof pricing.starter !== 'number' || pricing.starter <= 0 ||
        typeof pricing.standard !== 'number' || pricing.standard <= 0 ||
        typeof pricing.premium !== 'number' || pricing.premium <= 0) {
      return 'TON pricing must have positive values for all tiers'
    }
  }

  return null
}

export async function GET() {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Get settings from admin_settings table
    const [setting] = await sql`
      SELECT value, updated_at FROM admin_settings WHERE key = ${SETTINGS_KEY}
    `.catch(() => [null])

    if (setting?.value) {
      // Merge with defaults to ensure all fields exist
      const settings: PaymentMethodsSettings = {
        ...DEFAULT_PAYMENT_METHODS,
        ...setting.value,
        tbank: { ...DEFAULT_PAYMENT_METHODS.tbank, ...setting.value.tbank },
        stars: { ...DEFAULT_PAYMENT_METHODS.stars, ...setting.value.stars },
        ton: { ...DEFAULT_PAYMENT_METHODS.ton, ...setting.value.ton }
      }

      return NextResponse.json({
        settings,
        updatedAt: setting.updated_at
      })
    }

    // Return defaults if not set
    return NextResponse.json({
      settings: DEFAULT_PAYMENT_METHODS,
      updatedAt: null
    })
  } catch (error) {
    console.error('[Admin Settings Payment-Methods] GET Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment methods settings' },
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
    const { settings } = body as { settings: PaymentMethodsSettings }

    if (!settings) {
      return NextResponse.json(
        { error: 'Settings object is required' },
        { status: 400 }
      )
    }

    // Validate settings
    const validationError = validateSettings(settings)
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      )
    }
    // Get old settings for audit log
    const [oldSetting] = await sql`
      SELECT value FROM admin_settings WHERE key = ${SETTINGS_KEY}
    `.catch(() => [null])

    // Upsert the setting
    await sql`
      INSERT INTO admin_settings (key, value, updated_at)
      VALUES (${SETTINGS_KEY}, ${JSON.stringify(settings)}::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = ${JSON.stringify(settings)}::jsonb, updated_at = NOW()
    `

    // Log the action
    await logAdminAction({
      adminId: session.adminId,
      action: 'settings_updated',
      targetType: 'setting',
      metadata: {
        settingKey: SETTINGS_KEY,
        old: oldSetting?.value || null,
        new: settings,
        changes: {
          tbank_enabled: settings.tbank?.enabled,
          stars_enabled: settings.stars?.enabled,
          ton_enabled: settings.ton?.enabled
        }
      }
    })

    return NextResponse.json({
      success: true,
      settings,
      message: 'Payment methods settings saved successfully'
    })
  } catch (error) {
    console.error('[Admin Settings Payment-Methods] PUT Error:', error)
    return NextResponse.json(
      { error: 'Failed to save payment methods settings' },
      { status: 500 }
    )
  }
}
