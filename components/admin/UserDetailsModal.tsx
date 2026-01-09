'use client'

import { useState, useEffect } from 'react'
import {
  X,
  User,
  CreditCard,
  Image,
  Users,
  Loader2,
  AlertCircle,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink
} from 'lucide-react'

interface UserDetailsModalProps {
  userId: number | null
  isOpen: boolean
  onClose: () => void
  onAction?: () => void
}

interface UserDetails {
  user: {
    id: number
    telegram_user_id: string
    telegram_username: string | null
    is_banned: boolean
    ban_reason: string | null
    banned_at: string | null
    referral_code: string | null
    referred_by: string | null
    total_earnings: number
    created_at: string
    updated_at: string
  }
  avatars: Array<{
    id: number
    name: string
    status: string
    thumbnail_url: string | null
    created_at: string
    photo_count: number
  }>
  payments: Array<{
    id: number
    tbank_payment_id: string
    amount: number
    tier_id: string
    photo_count: number
    status: string
    created_at: string
    provider: string
    stars_amount?: number
    ton_amount?: number
    telegram_charge_id?: string
    ton_tx_hash?: string
  }>
  jobs: Array<{
    id: number
    avatar_id: number
    style_id: string
    status: string
    total_photos: number
    completed_photos: number
    error_message: string | null
    created_at: string
    avatar_name: string
    photos?: Array<{
      id: number
      image_url: string
      prompt_index: number
    }>
  }>
  referralStats: {
    referral_count: number
    paid_referral_count: number
    total_earned: number
  }
}

type TabId = 'overview' | 'avatars' | 'payments' | 'generations' | 'referral'

export function UserDetailsModal({ userId, isOpen, onClose, onAction }: UserDetailsModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<UserDetails | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null)
  const [loadingPhotos, setLoadingPhotos] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserDetails()
    }
  }, [isOpen, userId])

  const fetchUserDetails = async () => {
    if (!userId) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/admin/users/${userId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch user details')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const loadJobPhotos = async (jobId: number) => {
    if (loadingPhotos === jobId) return

    // Toggle if already expanded
    if (expandedJobId === jobId) {
      setExpandedJobId(null)
      return
    }

    // Check if photos already loaded
    const job = data?.jobs.find(j => j.id === jobId)
    if (job?.photos) {
      setExpandedJobId(jobId)
      return
    }

    try {
      setLoadingPhotos(jobId)
      const response = await fetch(`/api/admin/generations/${jobId}/photos`)
      if (!response.ok) throw new Error('Failed to load photos')

      const result = await response.json()

      // Update data with photos
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          jobs: prev.jobs.map(j =>
            j.id === jobId ? { ...j, photos: result.photos } : j
          )
        }
      })

      setExpandedJobId(jobId)
    } catch (err) {
      console.error('Failed to load photos:', err)
    } finally {
      setLoadingPhotos(null)
    }
  }

  if (!isOpen) return null

  const tabs = [
    { id: 'overview' as const, label: 'Обзор', icon: User },
    { id: 'avatars' as const, label: 'Аватары', icon: Image },
    { id: 'payments' as const, label: 'Платежи', icon: CreditCard },
    { id: 'generations' as const, label: 'Генерации', icon: RefreshCw },
    { id: 'referral' as const, label: 'Реферал', icon: Users }
  ]

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
              <User className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Пользователь #{userId}
              </h2>
              {data && (
                <p className="text-sm text-slate-500">
                  TG: {data.user.telegram_user_id}
                  {data.user.telegram_username && (
                    <a
                      href={`https://t.me/${data.user.telegram_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      @{data.user.telegram_username}
                    </a>
                  )}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-4 overflow-x-auto bg-white">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-pink-500 text-slate-800'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-red-600">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          ) : data ? (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                      Информация
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600">ID</span>
                        <span className="text-slate-800 font-mono font-medium">{data.user.id}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600">Telegram ID</span>
                        <span className="text-slate-800 font-mono font-medium">{data.user.telegram_user_id}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600">Username</span>
                        {data.user.telegram_username ? (
                          <a
                            href={`https://t.me/${data.user.telegram_username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            @{data.user.telegram_username}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                      {data.user.is_banned && (
                        <div className="flex justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                          <span className="text-red-600">Статус</span>
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium border border-red-300">
                            Забанен
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600">Регистрация</span>
                        <span className="text-slate-800 font-medium">{formatDate(data.user.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                      Статистика
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 rounded-lg p-4 text-center border border-slate-200">
                        <p className="text-2xl font-bold text-slate-800">{data.avatars.length}</p>
                        <p className="text-xs text-slate-600 font-medium">Аватаров</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 text-center border border-slate-200">
                        <p className="text-2xl font-bold text-slate-800">
                          {data.payments.filter(p => p.status === 'succeeded').length}
                        </p>
                        <p className="text-xs text-slate-600 font-medium">Платежей</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 text-center border border-slate-200">
                        <p className="text-2xl font-bold text-slate-800">
                          {data.referralStats.referral_count}
                        </p>
                        <p className="text-xs text-slate-600 font-medium">Рефералов</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 text-center border border-slate-200">
                        <div className="space-y-1">
                          {(() => {
                            const succeededPayments = data.payments.filter(p => p.status === 'succeeded')
                            const rubTotal = succeededPayments
                              .filter(p => p.provider === 'tbank')
                              .reduce((sum, p) => sum + Number(p.amount || 0), 0)
                            const tonTotal = succeededPayments
                              .filter(p => p.provider === 'ton')
                              .reduce((sum, p) => sum + Number(p.ton_amount || 0), 0)
                            const starsTotal = succeededPayments
                              .filter(p => p.provider === 'stars')
                              .reduce((sum, p) => sum + Number(p.stars_amount || 0), 0)
                            
                            return (
                              <>
                                {rubTotal > 0 && (
                                  <p className="text-xl font-bold text-emerald-600">
                                    {rubTotal.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₽
                                  </p>
                                )}
                                {tonTotal > 0 && (
                                  <p className="text-xl font-bold text-emerald-600">
                                    {tonTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} TON
                                  </p>
                                )}
                                {starsTotal > 0 && (
                                  <p className="text-xl font-bold text-emerald-600">
                                    {starsTotal.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ⭐
                                  </p>
                                )}
                                {rubTotal === 0 && tonTotal === 0 && starsTotal === 0 && (
                                  <p className="text-xl font-bold text-slate-400">0 ₽</p>
                                )}
                              </>
                            )
                          })()}
                        </div>
                        <p className="text-xs text-slate-600 font-medium mt-1">Потрачено</p>
                      </div>
                    </div>
                  </div>

                  {data.user.is_banned && data.user.ban_reason && (
                    <div className="col-span-2 bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-red-700">
                        <strong>Причина бана:</strong> {data.user.ban_reason}
                      </p>
                      {data.user.banned_at && (
                        <p className="text-xs text-red-600 mt-1">
                          Забанен: {formatDate(data.user.banned_at)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Avatars Tab */}
              {activeTab === 'avatars' && (
                <div className="space-y-4">
                  {data.avatars.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">Нет аватаров</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      {data.avatars.map(avatar => (
                        <div
                          key={avatar.id}
                          className="bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm"
                        >
                          <div className="aspect-square bg-slate-100">
                            {avatar.thumbnail_url ? (
                              <img
                                src={avatar.thumbnail_url}
                                alt={avatar.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Image className="w-8 h-8 text-slate-400" />
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {avatar.name}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                avatar.status === 'ready'
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                  : avatar.status === 'processing'
                                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                    : 'bg-amber-100 text-amber-700 border border-amber-300'
                              }`}>
                                {avatar.status}
                              </span>
                              <span className="text-xs text-slate-600 font-medium">
                                {avatar.photo_count} фото
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Payments Tab */}
              {activeTab === 'payments' && (
                <div className="space-y-4">
                  {data.payments.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">Нет платежей</p>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-slate-600 uppercase font-semibold">
                          <th className="pb-3">Провайдер</th>
                          <th className="pb-3">ID</th>
                          <th className="pb-3">Сумма</th>
                          <th className="pb-3">Тариф</th>
                          <th className="pb-3">Статус</th>
                          <th className="pb-3">Дата</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {data.payments.map(payment => {
                          // Get payment ID based on provider
                          const paymentId = payment.provider === 'stars'
                            ? payment.telegram_charge_id
                            : payment.provider === 'ton'
                              ? payment.ton_tx_hash
                              : payment.tbank_payment_id

                          // Format amount based on provider
                          const formattedAmount = payment.provider === 'stars'
                            ? `${payment.stars_amount} ⭐`
                            : payment.provider === 'ton'
                              ? `${Number(payment.ton_amount)?.toFixed(2)} TON`
                              : `${payment.amount.toLocaleString('ru-RU')} ₽`

                          return (
                            <tr key={payment.id} className="hover:bg-slate-50">
                              <td className="py-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  payment.provider === 'stars'
                                    ? 'bg-purple-100 text-purple-700 border border-purple-300'
                                    : payment.provider === 'ton'
                                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                      : 'bg-slate-100 text-slate-700 border border-slate-300'
                                }`}>
                                  {payment.provider === 'stars' ? 'Stars' : payment.provider === 'ton' ? 'TON' : 'T-Bank'}
                                </span>
                              </td>
                              <td className="py-3 font-mono text-sm text-slate-600">
                                {paymentId ? `${paymentId.slice(0, 8)}...` : '—'}
                              </td>
                              <td className="py-3 text-slate-800 font-medium">
                                {formattedAmount}
                              </td>
                              <td className="py-3">
                                <span className="text-sm text-slate-600">
                                  {payment.tier_id} ({payment.photo_count} фото)
                                </span>
                              </td>
                              <td className="py-3">
                                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                                  payment.status === 'succeeded'
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                    : payment.status === 'pending'
                                      ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                      : 'bg-red-100 text-red-700 border border-red-300'
                                }`}>
                                  {payment.status === 'succeeded' && <CheckCircle className="w-3 h-3" />}
                                  {payment.status === 'pending' && <Clock className="w-3 h-3" />}
                                  {payment.status === 'canceled' && <XCircle className="w-3 h-3" />}
                                  {payment.status}
                                </span>
                              </td>
                              <td className="py-3 text-sm text-slate-600">
                                {formatDate(payment.created_at)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Generations Tab */}
              {activeTab === 'generations' && (
                <div className="space-y-4">
                  {data.jobs.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">Нет генераций</p>
                  ) : (
                    <div className="space-y-2">
                      {data.jobs.map(job => (
                        <div key={job.id} className="border border-slate-200 rounded-lg overflow-hidden">
                          {/* Job Header - Clickable */}
                          <button
                            onClick={() => loadJobPhotos(job.id)}
                            className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors text-left"
                          >
                            <span className="font-mono text-sm text-slate-500">#{job.id}</span>
                            <span className="text-slate-800 font-medium flex-1">
                              {job.avatar_name || `Avatar #${job.avatar_id}`}
                            </span>
                            <span className="text-sm text-slate-600">{job.style_id}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-pink-500 rounded-full transition-all"
                                  style={{
                                    width: `${(job.completed_photos / job.total_photos) * 100}%`
                                  }}
                                />
                              </div>
                              <span className="text-xs text-slate-600 font-medium w-12">
                                {job.completed_photos}/{job.total_photos}
                              </span>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              job.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                : job.status === 'processing'
                                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                  : job.status === 'failed'
                                    ? 'bg-red-100 text-red-700 border border-red-300'
                                    : 'bg-amber-100 text-amber-700 border border-amber-300'
                            }`}>
                              {job.status}
                            </span>
                            <span className="text-sm text-slate-500 w-36 text-right">
                              {formatDate(job.created_at)}
                            </span>
                            {loadingPhotos === job.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                            ) : expandedJobId === job.id ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </button>

                          {/* Photos Grid - Expandable */}
                          {expandedJobId === job.id && job.photos && (
                            <div className="border-t border-slate-200 p-4 bg-slate-50">
                              {job.photos.length === 0 ? (
                                <p className="text-center text-slate-500 py-4">Нет фото</p>
                              ) : (
                                <div className="grid grid-cols-4 gap-3">
                                  {job.photos.map(photo => (
                                    <div
                                      key={photo.id}
                                      className="relative group aspect-square rounded-lg overflow-hidden bg-slate-200"
                                    >
                                      <img
                                        src={photo.image_url}
                                        alt={`Photo ${photo.prompt_index + 1}`}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                      />
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <a
                                          href={photo.image_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
                                          title="Открыть"
                                        >
                                          <ExternalLink className="w-4 h-4 text-slate-700" />
                                        </a>
                                        <a
                                          href={photo.image_url}
                                          download={`photo-${job.id}-${photo.prompt_index + 1}.jpg`}
                                          className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
                                          title="Скачать"
                                        >
                                          <Download className="w-4 h-4 text-slate-700" />
                                        </a>
                                      </div>
                                      <span className="absolute bottom-1 right-1 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                                        #{photo.prompt_index + 1}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Referral Tab */}
              {activeTab === 'referral' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4 text-center border border-slate-200">
                      <p className="text-2xl font-bold text-slate-800">
                        {data.referralStats.referral_count}
                      </p>
                      <p className="text-xs text-slate-600 font-medium">Всего рефералов</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 text-center border border-slate-200">
                      <p className="text-2xl font-bold text-emerald-600">
                        {data.referralStats.paid_referral_count}
                      </p>
                      <p className="text-xs text-slate-600 font-medium">Оплативших</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 text-center border border-slate-200">
                      <p className="text-2xl font-bold text-pink-600">
                        {Number(data.referralStats.total_earned).toLocaleString('ru-RU')} ₽
                      </p>
                      <p className="text-xs text-slate-600 font-medium">Заработано</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-slate-600">Реферальный код</span>
                      <span className="text-slate-800 font-mono font-medium">
                        {data.user.referral_code || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-slate-600">Приглашён по коду</span>
                      <span className="text-slate-800 font-mono font-medium">
                        {data.user.referred_by || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-slate-600">Баланс</span>
                      <span className="text-emerald-600 font-bold">
                        {Number(data.user.total_earnings || 0).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
