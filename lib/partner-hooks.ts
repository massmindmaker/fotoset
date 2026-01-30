'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  PartnerStats,
  EarningsResponse,
  ReferralsResponse,
  WithdrawalsResponse,
  WithdrawRequest,
  WithdrawResponse
} from './partner-types'

/**
 * Build query params for backward compatibility with Telegram WebApp.
 * For web login, API will use session cookie instead.
 */
function buildQueryParams(): string {
  if (typeof window === 'undefined') return ''

  const params = new URLSearchParams()

  // Check localStorage for Telegram WebApp users
  const telegramUserId = localStorage.getItem('pinglass_telegram_user_id')
  const neonUserId = localStorage.getItem('pinglass_neon_user_id')

  if (telegramUserId) params.set('telegram_user_id', telegramUserId)
  if (neonUserId) params.set('neon_user_id', neonUserId)

  return params.toString()
}

// Hook for partner stats
export function usePartnerStats() {
  const [stats, setStats] = useState<PartnerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)

      // Build URL with optional query params (for Telegram WebApp compatibility)
      // API will use session cookie if no query params provided
      const queryParams = buildQueryParams()
      const url = queryParams ? `/api/partner/stats?${queryParams}` : '/api/partner/stats'

      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch stats')
      }
      const data = await res.json()
      setStats(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return { stats, loading, error, refetch: fetchStats }
}

// Hook for earnings
export function usePartnerEarnings(page = 1, limit = 20, status = 'all', currency = 'all') {
  const [data, setData] = useState<EarningsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEarnings = useCallback(async () => {
    try {
      setLoading(true)

      // Build params with optional user IDs for backward compatibility
      const baseParams = buildQueryParams()
      const params = new URLSearchParams(baseParams)
      params.set('page', page.toString())
      params.set('limit', limit.toString())
      if (status !== 'all') params.set('status', status)
      if (currency !== 'all') params.set('currency', currency)

      const res = await fetch(`/api/partner/earnings?${params}`, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch earnings')
      }
      const responseData = await res.json()
      setData(responseData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [page, limit, status, currency])

  useEffect(() => {
    fetchEarnings()
  }, [fetchEarnings])

  return { data, loading, error, refetch: fetchEarnings }
}

// Hook for referrals
export function usePartnerReferrals(page = 1, limit = 20) {
  const [data, setData] = useState<ReferralsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReferrals = useCallback(async () => {
    try {
      setLoading(true)

      // Build params with optional user IDs for backward compatibility
      const baseParams = buildQueryParams()
      const params = new URLSearchParams(baseParams)
      params.set('page', page.toString())
      params.set('limit', limit.toString())

      const res = await fetch(`/api/partner/referrals?${params}`, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch referrals')
      }
      const responseData = await res.json()
      setData(responseData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [page, limit])

  useEffect(() => {
    fetchReferrals()
  }, [fetchReferrals])

  return { data, loading, error, refetch: fetchReferrals }
}

// Hook for withdrawals
export function useWithdrawals() {
  const [data, setData] = useState<WithdrawalsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWithdrawals = useCallback(async () => {
    try {
      setLoading(true)

      // Build URL with optional query params (for Telegram WebApp compatibility)
      // API will use session cookie if no query params provided
      const queryParams = buildQueryParams()
      const url = queryParams ? `/api/partner/withdrawals?${queryParams}` : '/api/partner/withdrawals'

      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch withdrawals')
      }
      const responseData = await res.json()
      setData(responseData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWithdrawals()
  }, [fetchWithdrawals])

  return { data, loading, error, refetch: fetchWithdrawals }
}

// Hook for partner packs
export interface PartnerPack {
  id: number
  name: string
  slug: string
  description: string | null
  iconEmoji: string
  previewImages: string[]
  moderationStatus: 'draft' | 'pending' | 'approved' | 'rejected'
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  usageCount: number
  promptCount: number
  submittedAt: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
}

export interface PartnerPacksResponse {
  success: boolean
  packs: PartnerPack[]
}

export function usePartnerPacks() {
  const [packs, setPacks] = useState<PartnerPack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPacks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Build URL with optional query params (for Telegram WebApp compatibility)
      // API will use session cookie if no query params provided
      const queryParams = buildQueryParams()
      const url = queryParams ? `/api/partner/packs?${queryParams}` : '/api/partner/packs'

      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || data.message || 'Failed to fetch packs')
      }
      const data: PartnerPacksResponse = await res.json()
      setPacks(data.packs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPacks()
  }, [fetchPacks])

  return { packs, loading, error, refetch: fetchPacks }
}

// Hook for creating withdrawal
export function useCreateWithdrawal() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createWithdrawal = useCallback(async (request: Omit<WithdrawRequest, 'telegramUserId'>): Promise<WithdrawResponse | null> => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/partner/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request)
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create withdrawal')
        return null
      }

      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { createWithdrawal, loading, error }
}
