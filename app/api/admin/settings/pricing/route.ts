/**
 * GET/PUT /api/admin/settings/pricing
 * Manage pricing tiers
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
import { hasPermission } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'

export interface PricingTier {
  name: string
  price: number
  photoCount: number
  isActive: boolean
  isPopular?: boolean
}

export interface PricingTiers {
  starter: PricingTier
  standard: PricingTier
  premium: PricingTier
}
// Default pricing if not in DB
const DEFAULT_PRICING: PricingTiers = {
  starter: { name: 'Starter', price: 499, photoCount: 7, isActive: true },
  standard: { name: 'Standard', price: 999, photoCount: 15, isActive: true, isPopular: true },
  premium: { name: 'Premium', price: 1499, photoCount: 23, isActive: true }
}

export async function GET() {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const [setting] = await sql`
      SELECT value, updated_at, updated_by
      FROM admin_settings
      WHERE key = 'pricing_tiers'
    `

    const pricing = setting?.value || DEFAULT_PRICING

    return NextResponse.json({
      pricing,
      updatedAt: setting?.updated_at,
      updatedBy: setting?.updated_by
    })
  } catch (error) {
    console.error('[Admin Pricing] GET Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pricing' },
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
    if (!hasPermission(session.role as 'super_admin' | 'admin' | 'viewer', 'settings.pricing')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { pricing } = body

    // Validate pricing
    if (!pricing || typeof pricing !== 'object') {
      return NextResponse.json({ error: 'Invalid pricing data' }, { status: 400 })
    }

    // Validate each tier
    for (const tierId of ['starter', 'standard', 'premium']) {
      const tier = pricing[tierId]
      if (!tier) {
        return NextResponse.json({ error: `Missing tier: ${tierId}` }, { status: 400 })
      }
      if (typeof tier.price !== 'number' || tier.price <= 0) {
        return NextResponse.json({ error: `Invalid price for ${tierId}` }, { status: 400 })
      }
      if (typeof tier.photoCount !== 'number' || tier.photoCount <= 0) {
        return NextResponse.json({ error: `Invalid photo count for ${tierId}` }, { status: 400 })
      }
    }
    // Update or insert
    await sql`
      INSERT INTO admin_settings (key, value, updated_by, updated_at)
      VALUES ('pricing_tiers', ${JSON.stringify(pricing)}, ${session.adminId}, NOW())
      ON CONFLICT (key) DO UPDATE
      SET value = ${JSON.stringify(pricing)},
          updated_by = ${session.adminId},
          updated_at = NOW()
    `

    // Audit log
    await logAdminAction({
      adminId: session.adminId,
      action: 'pricing_updated',
      targetType: 'setting',
      metadata: {
        newPricing: pricing
      }
    })

    return NextResponse.json({ success: true, pricing })
  } catch (error) {
    console.error('[Admin Pricing] PUT Error:', error)
    return NextResponse.json(
      { error: 'Failed to update pricing' },
      { status: 500 }
    )
  }
}
