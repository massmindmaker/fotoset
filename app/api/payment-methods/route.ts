/**
 * GET /api/payment-methods
 * Public endpoint for frontend to fetch available payment methods
 * No authentication required - returns only enabled/disabled status and pricing
 */

export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { DEFAULT_PAYMENT_METHODS } from '@/lib/admin/types'

const SETTINGS_KEY = 'payment_methods'

// Cache settings for 60 seconds to reduce DB load
let cachedSettings: any = null
let cacheTime = 0
const CACHE_TTL = 60 * 1000 // 1 minute

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

export async function GET() {
  try {
    const now = Date.now()

    // Return cached response if valid
    if (cachedSettings && (now - cacheTime) < CACHE_TTL) {
      return NextResponse.json(cachedSettings, {
        headers: {
          'Cache-Control': 'public, max-age=60',
        },
      })
    }

    const sql = getSql()

    // Get settings from admin_settings table
    const [setting] = await sql`
      SELECT value FROM admin_settings WHERE key = ${SETTINGS_KEY}
    `.catch(() => [null])

    // Build public response (only what frontend needs)
    const dbSettings = setting?.value || {}

    const publicMethods = {
      tbank: {
        enabled: dbSettings.tbank?.enabled ?? DEFAULT_PAYMENT_METHODS.tbank.enabled,
      },
      stars: {
        enabled: dbSettings.stars?.enabled ?? DEFAULT_PAYMENT_METHODS.stars.enabled,
        pricing: dbSettings.stars?.pricing ?? DEFAULT_PAYMENT_METHODS.stars.pricing,
      },
      ton: {
        enabled: dbSettings.ton?.enabled ?? DEFAULT_PAYMENT_METHODS.ton.enabled,
        pricing: dbSettings.ton?.pricing ?? DEFAULT_PAYMENT_METHODS.ton.pricing,
        // Note: walletAddress is NOT exposed to public for security
      },
    }

    const response = { methods: publicMethods }

    // Update cache
    cachedSettings = response
    cacheTime = now

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (error) {
    console.error('[Payment Methods API] Error:', error)

    // Return defaults on error (T-Bank only)
    return NextResponse.json({
      methods: {
        tbank: { enabled: true },
        stars: { enabled: false, pricing: {} },
        ton: { enabled: false, pricing: {} },
      },
    })
  }
}
