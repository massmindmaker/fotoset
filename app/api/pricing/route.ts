/**
 * GET /api/pricing
 * Public endpoint for fetching active pricing tiers
 */

export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { DEFAULT_PRICING, type PricingTiers } from '@/lib/pricing'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) return null
  return neon(url)
}

export async function GET() {
  try {
    const sql = getSql()

    if (!sql) {
      // No database - use defaults
      return NextResponse.json({
        pricing: DEFAULT_PRICING,
        source: 'default'
      })
    }

    const [setting] = await sql`
      SELECT value
      FROM admin_settings
      WHERE key = 'pricing_tiers'
    `

    if (!setting?.value) {
      return NextResponse.json({
        pricing: DEFAULT_PRICING,
        source: 'default'
      })
    }

    // Parse and validate
    const pricing = setting.value as PricingTiers

    // Ensure all required tiers exist
    const validPricing: PricingTiers = {
      starter: pricing.starter || DEFAULT_PRICING.starter,
      standard: pricing.standard || DEFAULT_PRICING.standard,
      premium: pricing.premium || DEFAULT_PRICING.premium
    }

    return NextResponse.json({
      pricing: validPricing,
      source: 'database'
    })
  } catch (error) {
    console.warn('[Pricing API] Error:', error)
    return NextResponse.json({
      pricing: DEFAULT_PRICING,
      source: 'fallback'
    })
  }
}
