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

// Get Telegram user ID from localStorage
function getTelegramUserId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('pinglass_telegram_user_id')
}

function buildQueryParams(telegramUserId: string): string {
  return `telegram_user_id=${telegramUserId}`
}

// Hook for partner stats
export function usePartnerStats() {
  const [stats, setStats] = useState<PartnerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    const telegramUserId = getTelegramUserId()
    if (!telegramUserId) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`/api/partner/stats?${buildQueryParams(telegramUserId)}`)
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
    const telegramUserId = getTelegramUserId()
    if (!telegramUserId) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const params = new URLSearchParams(buildQueryParams(telegramUserId))
      params.set('page', page.toString())
      params.set('limit', limit.toString())
      if (status !== 'all') params.set('status', status)
      if (currency !== 'all') params.set('currency', currency)

      const res = await fetch(`/api/partner/earnings?${params}`)
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
    const telegramUserId = getTelegramUserId()
    if (!telegramUserId) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const params = new URLSearchParams(buildQueryParams(telegramUserId))
      params.set('page', page.toString())
      params.set('limit', limit.toString())

      const res = await fetch(`/api/partner/referrals?${params}`)
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
    const telegramUserId = getTelegramUserId()
    if (!telegramUserId) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`/api/referral/withdraw?telegram_user_id=${telegramUserId}`)
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

// Hook for creating withdrawal
export function useCreateWithdrawal() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createWithdrawal = useCallback(async (request: Omit<WithdrawRequest, 'telegramUserId'>): Promise<WithdrawResponse | null> => {
    const telegramUserId = getTelegramUserId()
    if (!telegramUserId) {
      setError('Not authenticated')
      return null
    }

    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/referral/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          telegramUserId: parseInt(telegramUserId)
        })
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
