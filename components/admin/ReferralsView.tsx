'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Loader2,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Star,
  Coins,
  Phone,
  Key,
  LogOut,
  Settings
} from 'lucide-react'
import type { ReferralStats, TopReferrer, ReferralEarning, WithdrawalRequest } from '@/lib/admin/types'

/**
 * ReferralsView Component
 *
 * Referral system dashboard with stats, top referrers, and withdrawal management
 * Now includes Telegram Affiliate Program (Stars) configuration via MTProto
 */

type Tab = 'overview' | 'referrers' | 'withdrawals' | 'telegram-affiliate'

interface MTProtoStatus {
  configured: boolean
  authenticated: boolean
  user?: {
    id: string
    firstName: string
    lastName?: string
    username?: string
  }
}

interface AffiliateSettings {
  commissionPermille: number
  durationMonths: number
  isActive: boolean
}

export function ReferralsView() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [topReferrers, setTopReferrers] = useState<TopReferrer[]>([])
  const [recentEarnings, setRecentEarnings] = useState<ReferralEarning[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [withdrawalsPagination, setWithdrawalsPagination] = useState({ total: 0, totalPages: 0, page: 1 })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Withdrawal action state
  const [processingId, setProcessingId] = useState<number | null>(null)

  // MTProto/Affiliate state
  const [mtprotoStatus, setMtprotoStatus] = useState<MTProtoStatus | null>(null)
  const [affiliateSettings, setAffiliateSettings] = useState<AffiliateSettings | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [password2FA, setPassword2FA] = useState('')
  const [authStep, setAuthStep] = useState<'phone' | 'code' | '2fa' | 'done'>('phone')
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [newCommission, setNewCommission] = useState(100) // 10% default

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/referrals')
      if (!response.ok) throw new Error('Failed to fetch referral stats')

      const data = await response.json()
      setStats(data.stats)
      setTopReferrers(data.topReferrers)
      setRecentEarnings(data.recentEarnings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchWithdrawals = useCallback(async (page = 1) => {
    try {
      const response = await fetch(`/api/admin/referrals/withdrawals?page=${page}`)
      if (!response.ok) throw new Error('Failed to fetch withdrawals')

      const data = await response.json()
      setWithdrawals(data.withdrawals)
      setWithdrawalsPagination(data.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    }
  }, [])

  const fetchMTProtoStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/telegram/mtproto')
      if (!response.ok) return
      const data = await response.json()
      setMtprotoStatus(data)
      if (data.authenticated) {
        setAuthStep('done')
      }
    } catch {
      // Ignore - MTProto not configured
    }
  }, [])

  const fetchAffiliateSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/telegram/affiliate')
      if (!response.ok) return
      const data = await response.json()
      setAffiliateSettings(data.settings)
      if (data.settings?.commissionPermille) {
        setNewCommission(data.settings.commissionPermille)
      }
    } catch {
      // Ignore
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    if (activeTab === 'withdrawals') {
      fetchWithdrawals()
    }
    if (activeTab === 'telegram-affiliate') {
      fetchMTProtoStatus()
      fetchAffiliateSettings()
    }
  }, [activeTab, fetchWithdrawals, fetchMTProtoStatus, fetchAffiliateSettings])

  const handleWithdrawalAction = async (id: number, action: 'approve' | 'reject') => {
    if (!confirm(`Вы уверены, что хотите ${action === 'approve' ? 'одобрить' : 'отклонить'} этот запрос?`)) return

    setProcessingId(id)
    try {
      const response = await fetch(`/api/admin/referrals/withdrawals/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Action failed')
      }

      fetchWithdrawals(withdrawalsPagination.page)
      fetchStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setProcessingId(null)
    }
  }

  // MTProto Auth handlers
  const handleStartAuth = async () => {
    if (!phoneNumber) {
      setAuthError('Введите номер телефона')
      return
    }

    setIsAuthLoading(true)
    setAuthError(null)

    try {
      const response = await fetch('/api/admin/telegram/mtproto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', phoneNumber })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to start auth')

      if (data.requiresCode) {
        setAuthStep('code')
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!verificationCode) {
      setAuthError('Введите код')
      return
    }

    setIsAuthLoading(true)
    setAuthError(null)

    try {
      const response = await fetch('/api/admin/telegram/mtproto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', code: verificationCode })
      })

      const data = await response.json()

      // Check for 2FA requirement (API returns requires2FA: true)
      if (data.requires2FA) {
        setAuthStep('2fa')
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify')
      }

      setAuthStep('done')
      await fetchMTProtoStatus()
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleVerify2FA = async () => {
    if (!password2FA) {
      setAuthError('Введите пароль 2FA')
      return
    }

    setIsAuthLoading(true)
    setAuthError(null)

    try {
      const response = await fetch('/api/admin/telegram/mtproto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: '2fa', password: password2FA })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to verify 2FA')

      setAuthStep('done')
      fetchMTProtoStatus()
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    if (!confirm('Выйти из Telegram аккаунта?')) return

    setIsAuthLoading(true)
    try {
      await fetch('/api/admin/telegram/mtproto', { method: 'DELETE' })
      setMtprotoStatus(null)
      setAuthStep('phone')
      setPhoneNumber('')
      setVerificationCode('')
      setPassword2FA('')
    } catch {
      // Ignore
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleUpdateAffiliate = async () => {
    setIsAuthLoading(true)
    setAuthError(null)

    try {
      const response = await fetch('/api/admin/telegram/affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionPermille: newCommission, durationMonths: 0 })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update')

      fetchAffiliateSettings()
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setIsAuthLoading(false)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatMoney = (amount: number, currency: 'RUB' | 'TON' | 'STARS' = 'RUB') => {
    if (currency === 'TON') {
      return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' TON'
    }
    if (currency === 'STARS') {
      return amount.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ⭐'
    }
    return amount.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₽'
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="space-y-4">
          {/* Main Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-600 text-xs font-medium mb-1">
                <Users className="w-4 h-4" />
                Рефералы
              </div>
              <p className="text-2xl font-bold text-slate-800">{stats.total_referrals}</p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-600 text-xs font-medium mb-1">
                <Clock className="w-4 h-4" />
                Заявок на вывод
              </div>
              <p className="text-2xl font-bold text-slate-800">{stats.pending_withdrawals}</p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-purple-600 text-xs font-medium mb-1">
                <TrendingUp className="w-4 h-4" />
                Конверсия
              </div>
              <p className="text-2xl font-bold text-purple-600">
                {stats.funnel.registered > 0 ? Math.round((stats.funnel.paid / stats.funnel.registered) * 100) : 0}%
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-amber-600 text-xs font-medium mb-1">
                <Star className="w-4 h-4" />
                Stars (TG Affiliate)
              </div>
              <p className="text-sm text-slate-500">Обрабатывается Telegram</p>
            </div>
          </div>

          {/* Multi-currency Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* RUB Stats */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <h4 className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Рубли (₽)
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Заработано</p>
                  <p className="text-lg font-bold text-emerald-600">{formatMoney(stats.earned_rub || stats.total_earnings)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">На балансах</p>
                  <p className="text-lg font-bold text-amber-600">{formatMoney(stats.balance_rub || stats.pending_balance)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Выведено</p>
                  <p className="text-lg font-bold text-blue-600">{formatMoney(stats.withdrawn_rub || stats.total_withdrawn)}</p>
                </div>
              </div>
            </div>

            {/* TON Stats */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <h4 className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-2">
                <Coins className="w-4 h-4" />
                TON
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Заработано</p>
                  <p className="text-lg font-bold text-emerald-600">{formatMoney(stats.earned_ton || 0, 'TON')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">На балансах</p>
                  <p className="text-lg font-bold text-amber-600">{formatMoney(stats.balance_ton || 0, 'TON')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Выведено</p>
                  <p className="text-lg font-bold text-blue-600">{formatMoney(stats.withdrawn_ton || 0, 'TON')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Funnel */}
      {stats && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Воронка рефералов</h3>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-800">{stats.total_codes}</p>
              <p className="text-sm text-slate-500">Кодов создано</p>
            </div>
            <ArrowRight className="w-6 h-6 text-slate-400" />
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{stats.funnel.registered}</p>
              <p className="text-sm text-slate-500">Зарегистрировались</p>
            </div>
            <ArrowRight className="w-6 h-6 text-slate-400" />
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-600">{stats.funnel.paid}</p>
              <p className="text-sm text-slate-500">Оплатили</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-4 overflow-x-auto">
          {[
            { id: 'overview', label: 'Обзор' },
            { id: 'referrers', label: 'Топ рефереров' },
            { id: 'withdrawals', label: `Выводы${stats?.pending_withdrawals ? ` (${stats.pending_withdrawals})` : ''}` },
            { id: 'telegram-affiliate', label: '⭐ Telegram Stars' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-pink-500 text-slate-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={fetchStats}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-medium text-slate-800">Последние начисления</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {recentEarnings.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Начислений пока нет
              </div>
            ) : (
              recentEarnings.map(earning => (
                <div key={earning.id} className="flex items-center gap-4 p-4 hover:bg-slate-50">
                  <div className="flex-1">
                    <p className="text-sm text-slate-800">
                      <span className="text-slate-500">Реферер:</span> {earning.referrer_telegram_id}
                      <ArrowRight className="w-3 h-3 inline mx-2 text-slate-400" />
                      <span className="text-slate-500">Реферал:</span> {earning.referred_telegram_id}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{formatDate(earning.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-600 font-medium">{formatMoney(earning.amount)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      earning.status === 'confirmed' ? 'bg-emerald-100 text-emerald-600' :
                      'bg-amber-100 text-amber-600'
                    }`}>
                      {earning.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'referrers' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Telegram ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Код</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Рефералы</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Конверсии</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Заработано</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Баланс</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topReferrers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Рефереров пока нет
                  </td>
                </tr>
              ) : (
                topReferrers.map((referrer, index) => (
                  <tr key={referrer.user_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs">#{index + 1}</span>
                        <span className="text-slate-800 font-mono">{referrer.telegram_user_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-slate-600">
                      {referrer.referral_code || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-800">{referrer.referrals_count}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{referrer.conversions}</td>
                    <td className="px-4 py-3 text-right text-slate-800">{formatMoney(referrer.total_earned)}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{formatMoney(referrer.balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'withdrawals' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Пользователь</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Сумма</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">К выплате</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Метод</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Дата</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Заявок на вывод нет
                  </td>
                </tr>
              ) : (
                withdrawals.map(w => (
                  <tr key={w.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-500">#{w.id}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-800 font-mono text-sm">{w.telegram_user_id}</p>
                      <p className="text-xs text-slate-500">Баланс: {formatMoney(w.current_balance, w.currency || 'RUB')}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-800">{formatMoney(w.amount, w.currency || 'RUB')}</td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-emerald-600">{formatMoney(w.payout_amount, w.currency || 'RUB')}</p>
                      {w.ndfl_amount > 0 && (
                        <p className="text-xs text-slate-500">НДФЛ: {formatMoney(w.ndfl_amount, w.currency || 'RUB')}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {w.method === 'card' && w.card_number && (
                        <span>**** {w.card_number.slice(-4)}</span>
                      )}
                      {w.method === 'phone' && w.phone}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        w.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                        w.status === 'approved' || w.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                        w.status === 'rejected' ? 'bg-red-100 text-red-600' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {w.status === 'pending' && <Clock className="w-3 h-3" />}
                        {(w.status === 'approved' || w.status === 'completed') && <CheckCircle className="w-3 h-3" />}
                        {w.status === 'rejected' && <XCircle className="w-3 h-3" />}
                        {w.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(w.created_at)}</td>
                    <td className="px-4 py-3">
                      {w.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleWithdrawalAction(w.id, 'approve')}
                            disabled={processingId === w.id}
                            className="p-1.5 bg-emerald-100 hover:bg-emerald-200 rounded text-emerald-600 transition-colors disabled:opacity-50"
                            title="Одобрить"
                          >
                            {processingId === w.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleWithdrawalAction(w.id, 'reject')}
                            disabled={processingId === w.id}
                            className="p-1.5 bg-red-100 hover:bg-red-200 rounded text-red-600 transition-colors disabled:opacity-50"
                            title="Отклонить"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {withdrawalsPagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                Страница {withdrawalsPagination.page} из {withdrawalsPagination.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchWithdrawals(withdrawalsPagination.page - 1)}
                  disabled={withdrawalsPagination.page <= 1}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => fetchWithdrawals(withdrawalsPagination.page + 1)}
                  disabled={withdrawalsPagination.page >= withdrawalsPagination.totalPages}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Telegram Affiliate Tab */}
      {activeTab === 'telegram-affiliate' && (
        <div className="space-y-6">
          {/* Info Card */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
            <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Telegram Affiliate Program
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Официальная партнёрская программа Telegram Stars. Когда пользователь оплачивает Stars через реферальную ссылку,
              партнёр получает комиссию напрямую от Telegram на свой баланс Stars (удерживается 21 день).
            </p>
            <p className="text-xs text-slate-500">
              Для настройки требуется авторизация через MTProto API (user-only API, не Bot API).
            </p>
          </div>

          {/* MTProto Auth Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h4 className="font-medium text-slate-800 flex items-center gap-2">
                <Key className="w-4 h-4" />
                Авторизация MTProto
              </h4>
            </div>
            <div className="p-6">
              {mtprotoStatus?.authenticated ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <div>
                      <p className="font-medium text-emerald-700">Авторизован</p>
                      {mtprotoStatus.user && (
                        <p className="text-sm text-emerald-600">
                          {mtprotoStatus.user.firstName} {mtprotoStatus.user.lastName}
                          {mtprotoStatus.user.username && ` (@${mtprotoStatus.user.username})`}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleLogout}
                      disabled={isAuthLoading}
                      className="ml-auto p-2 text-slate-400 hover:text-red-500 transition-colors"
                      title="Выйти"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-w-md">
                  {authStep === 'phone' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Номер телефона
                        </label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="tel"
                              value={phoneNumber}
                              onChange={e => setPhoneNumber(e.target.value)}
                              placeholder="+79585584130"
                              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                            />
                          </div>
                          <button
                            onClick={handleStartAuth}
                            disabled={isAuthLoading}
                            className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50 flex items-center gap-2"
                          >
                            {isAuthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Войти'}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {authStep === 'code' && (
                    <>
                      <p className="text-sm text-slate-600">
                        Код подтверждения отправлен в Telegram на {phoneNumber}
                      </p>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Код из Telegram
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={verificationCode}
                            onChange={e => setVerificationCode(e.target.value)}
                            placeholder="12345"
                            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 font-mono text-center tracking-widest"
                            maxLength={5}
                          />
                          <button
                            onClick={handleVerifyCode}
                            disabled={isAuthLoading}
                            className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50 flex items-center gap-2"
                          >
                            {isAuthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Подтвердить'}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {authStep === '2fa' && (
                    <>
                      <p className="text-sm text-slate-600">
                        У вас включена двухфакторная аутентификация. Введите пароль.
                      </p>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Пароль 2FA
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={password2FA}
                            onChange={e => setPassword2FA(e.target.value)}
                            placeholder="••••••••"
                            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                          />
                          <button
                            onClick={handleVerify2FA}
                            disabled={isAuthLoading}
                            className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50 flex items-center gap-2"
                          >
                            {isAuthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Войти'}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {authError && (
                    <p className="text-sm text-red-500 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {authError}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Affiliate Settings Card */}
          {mtprotoStatus?.authenticated && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <h4 className="font-medium text-slate-800 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Настройки партнёрской программы
                </h4>
              </div>
              <div className="p-6 space-y-6">
                {/* Current Settings */}
                {affiliateSettings && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600">
                      Текущая комиссия: <span className="font-bold text-slate-800">{affiliateSettings.commissionPermille / 10}%</span>
                    </p>
                    <p className="text-sm text-slate-600">
                      Статус: {affiliateSettings.isActive ? (
                        <span className="text-emerald-600">Активна</span>
                      ) : (
                        <span className="text-slate-400">Не активна</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Update Form */}
                <div className="max-w-md">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Комиссия партнёрам (%)
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="range"
                      min="0"
                      max="500"
                      step="10"
                      value={newCommission}
                      onChange={e => setNewCommission(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-lg font-bold text-slate-800 w-16 text-right">
                      {newCommission / 10}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    0% = программа отключена, 50% = максимальная комиссия
                  </p>
                </div>

                <button
                  onClick={handleUpdateAffiliate}
                  disabled={isAuthLoading}
                  className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {isAuthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить настройки'}
                </button>

                {authError && (
                  <p className="text-sm text-red-500 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {authError}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
