/**
 * Exchange Rates Service
 * Fetches and caches currency conversion rates for XTR (Telegram Stars) and TON
 */

import { sql } from '../db'
import type { Currency, RateConversion, ExchangeRateDB } from './types'

// Rate expiration time (15 minutes for payment rate locking)
const RATE_LOCK_DURATION_MS = 15 * 60 * 1000

// Cache rates in memory for quick access
const rateCache = new Map<string, { rate: number; expiresAt: Date }>()

/**
 * Get the latest exchange rate from cache or database
 */
export async function getExchangeRate(
  fromCurrency: Currency,
  toCurrency: Currency = 'RUB'
): Promise<{ rate: number; fetchedAt: Date; expiresAt: Date } | null> {
  const cacheKey = `${fromCurrency}_${toCurrency}`
  const now = new Date()

  // Check memory cache first
  const cached = rateCache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return {
      rate: cached.rate,
      fetchedAt: new Date(cached.expiresAt.getTime() - RATE_LOCK_DURATION_MS),
      expiresAt: cached.expiresAt,
    }
  }

  // Fetch from database
  const result = await sql`
    SELECT rate, fetched_at, expires_at
    FROM exchange_rates
    WHERE from_currency = ${fromCurrency}
      AND to_currency = ${toCurrency}
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY fetched_at DESC
    LIMIT 1
  `.then((rows: any[]) => rows[0])

  if (!result) {
    return null
  }

  // Update cache
  const expiresAt = result.expires_at ? new Date(result.expires_at) : new Date(now.getTime() + RATE_LOCK_DURATION_MS)
  rateCache.set(cacheKey, {
    rate: Number(result.rate),
    expiresAt,
  })

  return {
    rate: Number(result.rate),
    fetchedAt: new Date(result.fetched_at),
    expiresAt,
  }
}

/**
 * Fetch fresh exchange rate from external API
 */
export async function fetchExchangeRate(
  fromCurrency: Currency,
  toCurrency: Currency = 'RUB'
): Promise<{ rate: number; source: string }> {
  let rate: number
  let source: string

  if (fromCurrency === 'XTR') {
    // Telegram Stars: Fixed rate from Telegram
    // 1 Star ≈ 0.013 USD ≈ 1.3 RUB (approximate, Telegram controls this)
    // For now, use admin-configured pricing instead of live rate
    rate = 1.0 // Stars are priced directly in admin panel
    source = 'admin_configured'
  } else if (fromCurrency === 'TON') {
    // TON: Fetch from CoinGecko API
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=rub',
        { next: { revalidate: 300 } } // Cache for 5 minutes
      )

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`)
      }

      const data = await response.json()
      rate = data['the-open-network']?.rub || 0

      if (!rate) {
        throw new Error('TON rate not available from CoinGecko')
      }

      source = 'coingecko'
    } catch (error) {
      console.error('[ExchangeRates] Failed to fetch TON rate:', error)
      // Fallback to last known rate
      const lastRate = await getExchangeRate('TON', 'RUB')
      if (lastRate) {
        return { rate: lastRate.rate, source: 'cached_fallback' }
      }
      // Emergency fallback
      rate = 300 // ~$3 USD
      source = 'emergency_fallback'
    }
  } else {
    // RUB to RUB = 1:1
    rate = 1.0
    source = 'identity'
  }

  // Store in database
  const expiresAt = new Date(Date.now() + RATE_LOCK_DURATION_MS)

  await sql`
    INSERT INTO exchange_rates (from_currency, to_currency, rate, source, expires_at)
    VALUES (${fromCurrency}, ${toCurrency}, ${rate}, ${source}, ${expiresAt})
  `

  // Update cache
  rateCache.set(`${fromCurrency}_${toCurrency}`, { rate, expiresAt })

  return { rate, source }
}

/**
 * Convert amount from one currency to RUB
 */
export async function convertToRUB(
  amount: number,
  fromCurrency: Currency
): Promise<RateConversion> {
  if (fromCurrency === 'RUB') {
    const now = new Date()
    return {
      originalAmount: amount,
      originalCurrency: 'RUB',
      convertedAmount: amount,
      convertedCurrency: 'RUB',
      rate: 1.0,
      rateLockedAt: now,
      rateExpiresAt: new Date(now.getTime() + RATE_LOCK_DURATION_MS),
    }
  }

  // Get or fetch rate
  let rateData = await getExchangeRate(fromCurrency, 'RUB')

  if (!rateData) {
    const freshRate = await fetchExchangeRate(fromCurrency, 'RUB')
    rateData = {
      rate: freshRate.rate,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + RATE_LOCK_DURATION_MS),
    }
  }

  const convertedAmount = amount * rateData.rate

  return {
    originalAmount: amount,
    originalCurrency: fromCurrency,
    convertedAmount: Math.round(convertedAmount * 100) / 100, // Round to 2 decimals
    convertedCurrency: 'RUB',
    rate: rateData.rate,
    rateLockedAt: rateData.fetchedAt,
    rateExpiresAt: rateData.expiresAt,
  }
}

/**
 * Get all recent exchange rates for admin dashboard
 */
export async function getRecentRates(limit = 50): Promise<ExchangeRateDB[]> {
  const result = await sql`
    SELECT *
    FROM exchange_rates
    ORDER BY fetched_at DESC
    LIMIT ${limit}
  `

  return result as ExchangeRateDB[]
}

/**
 * Manually set exchange rate (admin function)
 */
export async function setManualRate(
  fromCurrency: Currency,
  toCurrency: Currency,
  rate: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await sql`
    INSERT INTO exchange_rates (from_currency, to_currency, rate, source, expires_at)
    VALUES (${fromCurrency}, ${toCurrency}, ${rate}, 'manual', ${expiresAt})
  `

  // Update cache
  rateCache.set(`${fromCurrency}_${toCurrency}`, { rate, expiresAt })
}
