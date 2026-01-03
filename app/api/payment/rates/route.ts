/**
 * GET /api/payment/rates
 * Get current exchange rates for XTR (Stars) and TON to RUB
 */

import { NextRequest, NextResponse } from 'next/server'
import { getExchangeRate, fetchExchangeRate } from '@/lib/payments/rates'

// Cache for 5 minutes
export const revalidate = 300

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get('refresh') === 'true'

    let tonRate = await getExchangeRate('TON', 'RUB')
    let starsRate = await getExchangeRate('XTR', 'RUB')

    // Fetch fresh rates if requested or not cached
    if (refresh || !tonRate) {
      const freshTon = await fetchExchangeRate('TON', 'RUB')
      tonRate = {
        rate: freshTon.rate,
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      }
    }

    if (refresh || !starsRate) {
      const freshStars = await fetchExchangeRate('XTR', 'RUB')
      starsRate = {
        rate: freshStars.rate,
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      }
    }

    return NextResponse.json({
      rates: {
        TON: {
          rate: tonRate?.rate || 0,
          currency: 'RUB',
          fetchedAt: tonRate?.fetchedAt,
          expiresAt: tonRate?.expiresAt,
        },
        XTR: {
          rate: starsRate?.rate || 1,
          currency: 'RUB',
          fetchedAt: starsRate?.fetchedAt,
          expiresAt: starsRate?.expiresAt,
          note: 'Stars use fixed pricing from admin settings',
        },
      },
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (error) {
    console.error('[Rates API] Error:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch rates',
        rates: {
          TON: { rate: 300, currency: 'RUB', note: 'Fallback rate' },
          XTR: { rate: 1, currency: 'RUB', note: 'Fixed pricing' },
        },
      },
      { status: 500 }
    )
  }
}
