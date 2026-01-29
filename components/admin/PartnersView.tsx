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
  Star,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Percent,
  UserCheck,
  UserX,
  Package,
  ShieldCheck
} from 'lucide-react'
import { PackModerationView } from './PackModerationView'

interface PartnerApplication {
  id: number
  userId: number
  telegramUserId: number
  contactName: string
  contactEmail: string | null
  contactPhone: string | null
  telegramUsername: string | null
  audienceSize: string | null
  audienceType: string | null
  promotionChannels: string | null
  websiteUrl: string | null
  socialLinks: string[] | null
  message: string | null
  expectedReferrals: number | null
  status: 'pending' | 'approved' | 'rejected'
  rejectionReason: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  adminNotes: string | null
  createdAt: string
  referralsCount: number
  totalEarned: number
  balance: number
  commissionRate: number
  isPartner: boolean
}

interface ActivePartner {
  userId: number
  telegramUserId: number
  telegramUsername: string | null
  referralsCount: number
  totalEarned: number
  balance: number
  commissionRate: number
  partnerApprovedAt: string
}

interface PartnerStats {
  totalPartners: number
  partnerEarnings: number
  partnerReferrals: number
}

type Tab = 'pending' | 'approved' | 'rejected' | 'active' | 'moderation'

export function PartnersView() {
  const [activeTab, setActiveTab] = useState<Tab>('pending')
  const [applications, setApplications] = useState<PartnerApplication[]>([])
  const [activePartners, setActivePartners] = useState<ActivePartner[]>([])
  const [stats, setStats] = useState<PartnerStats | null>(null)
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const status = activeTab === 'active' ? 'approved' : activeTab
      const response = await fetch(`/api/admin/partners?status=${status}`)
      if (!response.ok) throw new Error('Failed to fetch partners')

      const data = await response.json()
      setApplications(data.applications)
      setActivePartners(data.activePartners)
      setStats(data.stats)
      setCounts(data.counts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setIsLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleApprove = async (id: number) => {
    if (!confirm('Одобрить заявку? Пользователь получит 50% комиссию.')) return

    setProcessingId(id)
    try {
      const response = await fetch(`/api/admin/partners/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to approve')
      }

      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (id: number) => {
    if (!rejectionReason.trim()) {
      setError('Укажите причину отказа')
      return
    }

    setProcessingId(id)
    try {
      const response = await fetch(`/api/admin/partners/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectionReason: rejectionReason.trim() })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reject')
      }

      setShowRejectModal(null)
      setRejectionReason('')
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setProcessingId(null)
    }
  }

  const handleRevoke = async (userId: number) => {
    if (!confirm('Отозвать партнёрский статус? Комиссия станет 10%.')) return

    setProcessingId(userId)
    try {
      const response = await fetch(`/api/admin/partners/${userId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to revoke')
      }

      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setProcessingId(null)
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

  const formatMoney = (amount: number) => {
    return amount.toLocaleString('ru-RU', { minimumFractionDigits: 0 }) + ' ₽'
  }

  const audienceSizeLabels: Record<string, string> = {
    small: '< 1K',
    medium: '1K - 10K',
    large: '10K - 100K',
    huge: '> 100K'
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600 text-xs font-medium mb-1">
              <Star className="w-4 h-4" />
              Партнёров
            </div>
            <p className="text-2xl font-bold text-amber-600">{stats.totalPartners}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium mb-1">
              <DollarSign className="w-4 h-4" />
              Выплачено партнёрам
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatMoney(stats.partnerEarnings)}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600 text-xs font-medium mb-1">
              <Users className="w-4 h-4" />
              Рефералов от партнёров
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.partnerReferrals}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-pink-600 text-xs font-medium mb-1">
              <Clock className="w-4 h-4" />
              Ожидают рассмотрения
            </div>
            <p className="text-2xl font-bold text-pink-600">{counts.pending}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-4 overflow-x-auto">
          {[
            { id: 'pending', label: `Заявки (${counts.pending})`, icon: Clock },
            { id: 'active', label: `Партнёры (${stats?.totalPartners || 0})`, icon: Star },
            { id: 'moderation', label: 'Модерация паков', icon: ShieldCheck },
            { id: 'approved', label: 'Одобренные', icon: CheckCircle },
            { id: 'rejected', label: 'Отклонённые', icon: XCircle },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-pink-500 text-slate-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={fetchData}
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

      {/* Pack Moderation Tab */}
      {activeTab === 'moderation' && (
        <PackModerationView />
      )}

      {/* Active Partners Tab */}
      {activeTab === 'active' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Партнёр</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Комиссия</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Рефералы</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Заработано</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Баланс</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">С</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activePartners.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Активных партнёров пока нет
                  </td>
                </tr>
              ) : (
                activePartners.map(partner => (
                  <tr key={partner.userId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-mono text-sm text-slate-800">{partner.telegramUserId}</p>
                      {partner.telegramUsername && (
                        <a
                          href={`https://t.me/${partner.telegramUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          @{partner.telegramUsername}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                        <Percent className="w-3 h-3" />
                        {Math.round(partner.commissionRate * 100)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-800">{partner.referralsCount}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatMoney(partner.totalEarned)}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{formatMoney(partner.balance)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {partner.partnerApprovedAt ? formatDate(partner.partnerApprovedAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRevoke(partner.userId)}
                        disabled={processingId === partner.userId}
                        className="p-1.5 bg-red-100 hover:bg-red-200 rounded text-red-600 transition-colors disabled:opacity-50"
                        title="Отозвать партнёрство"
                      >
                        {processingId === partner.userId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserX className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Applications List */}
      {activeTab !== 'active' && (
        <div className="space-y-4">
          {applications.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              {activeTab === 'pending' ? 'Нет заявок на рассмотрение' :
               activeTab === 'approved' ? 'Нет одобренных заявок' : 'Нет отклонённых заявок'}
            </div>
          ) : (
            applications.map(app => (
              <div key={app.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Header */}
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-slate-800">{app.contactName}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        app.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                        app.status === 'approved' ? 'bg-emerald-100 text-emerald-600' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {app.status === 'pending' ? 'На рассмотрении' :
                         app.status === 'approved' ? 'Одобрено' : 'Отклонено'}
                      </span>
                      {app.isPartner && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          Партнёр {Math.round(app.commissionRate * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                      <span>TG: {app.telegramUserId}</span>
                      {app.telegramUsername && <span>@{app.telegramUsername}</span>}
                      {app.audienceSize && <span>Аудитория: {audienceSizeLabels[app.audienceSize] || app.audienceSize}</span>}
                      <span>{formatDate(app.createdAt)}</span>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-slate-500">Рефералы</p>
                      <p className="font-medium text-slate-800">{app.referralsCount}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-500">Заработано</p>
                      <p className="font-medium text-emerald-600">{formatMoney(app.totalEarned)}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  {app.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApprove(app.id) }}
                        disabled={processingId === app.id}
                        className="p-2 bg-emerald-100 hover:bg-emerald-200 rounded-lg text-emerald-600 transition-colors disabled:opacity-50"
                        title="Одобрить (50%)"
                      >
                        {processingId === app.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <UserCheck className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowRejectModal(app.id) }}
                        className="p-2 bg-red-100 hover:bg-red-200 rounded-lg text-red-600 transition-colors"
                        title="Отклонить"
                      >
                        <UserX className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  {expandedId === app.id ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                {/* Expanded Details */}
                {expandedId === app.id && (
                  <div className="border-t border-slate-200 p-4 bg-slate-50 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      {app.contactEmail && (
                        <div>
                          <p className="text-slate-500">Email</p>
                          <p className="text-slate-800">{app.contactEmail}</p>
                        </div>
                      )}
                      {app.contactPhone && (
                        <div>
                          <p className="text-slate-500">Телефон</p>
                          <p className="text-slate-800">{app.contactPhone}</p>
                        </div>
                      )}
                      {app.audienceType && (
                        <div>
                          <p className="text-slate-500">Тип аудитории</p>
                          <p className="text-slate-800">{app.audienceType}</p>
                        </div>
                      )}
                      {app.expectedReferrals && (
                        <div>
                          <p className="text-slate-500">Ожидаемые рефералы/мес</p>
                          <p className="text-slate-800">{app.expectedReferrals}</p>
                        </div>
                      )}
                      {app.websiteUrl && (
                        <div>
                          <p className="text-slate-500">Сайт</p>
                          <a href={app.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                            {app.websiteUrl}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>

                    {app.promotionChannels && (
                      <div className="text-sm">
                        <p className="text-slate-500 mb-1">Каналы продвижения</p>
                        <p className="text-slate-800">{app.promotionChannels}</p>
                      </div>
                    )}

                    {app.message && (
                      <div className="text-sm">
                        <p className="text-slate-500 mb-1">Сообщение</p>
                        <p className="text-slate-800 whitespace-pre-wrap">{app.message}</p>
                      </div>
                    )}

                    {app.rejectionReason && (
                      <div className="text-sm p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-600 font-medium mb-1">Причина отказа:</p>
                        <p className="text-red-700">{app.rejectionReason}</p>
                      </div>
                    )}

                    {app.reviewedAt && (
                      <p className="text-xs text-slate-500">
                        Рассмотрено: {formatDate(app.reviewedAt)} {app.reviewedBy && `(${app.reviewedBy})`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowRejectModal(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Отклонить заявку</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Укажите причину отказа..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
              rows={4}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowRejectModal(null); setRejectionReason('') }}
                className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => handleReject(showRejectModal)}
                disabled={processingId === showRejectModal || !rejectionReason.trim()}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {processingId === showRejectModal ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Отклонить'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
