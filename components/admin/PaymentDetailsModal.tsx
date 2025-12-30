'use client'

import { useState, useEffect } from 'react'
import {
  X,
  CreditCard,
  User,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  AlertCircle,
  Image,
  ExternalLink,
  Undo2
} from 'lucide-react'

interface PaymentDetailsModalProps {
  paymentId: number | null
  isOpen: boolean
  onClose: () => void
  onRefund?: () => void
}

interface PaymentDetails {
  id: number
  tbank_payment_id: string
  user_id: number
  telegram_user_id: string
  amount: number
  tier_id: string
  photo_count: number
  status: string
  email: string | null
  error_code: string | null
  error_message: string | null
  refund_id: string | null
  refund_reason: string | null
  created_at: string
  updated_at: string
  // Related data
  user_is_pro: boolean
  avatar_id: number | null
  avatar_name: string | null
  avatar_status: string | null
  photos_generated: number
}

export function PaymentDetailsModal({ paymentId, isOpen, onClose, onRefund }: PaymentDetailsModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payment, setPayment] = useState<PaymentDetails | null>(null)
  const [refunding, setRefunding] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [showRefundForm, setShowRefundForm] = useState(false)

  useEffect(() => {
    if (isOpen && paymentId) {
      fetchPaymentDetails()
    }
  }, [isOpen, paymentId])

  const fetchPaymentDetails = async () => {
    if (!paymentId) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/admin/payments/${paymentId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch payment details')
      }

      const data = await response.json()
      setPayment(data.payment)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleRefund = async () => {
    if (!paymentId || !refundReason.trim()) return

    try {
      setRefunding(true)
      const response = await fetch('/api/admin/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          reason: refundReason.trim()
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Refund failed')
      }

      await fetchPaymentDetails()
      setShowRefundForm(false)
      setRefundReason('')
      onRefund?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund failed')
    } finally {
      setRefunding(false)
    }
  }

  if (!isOpen) return null

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Успешно
          </span>
        )
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium">
            <Clock className="w-4 h-4" />
            В обработке
          </span>
        )
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium">
            <Undo2 className="w-4 h-4" />
            Возвращён
          </span>
        )
      case 'canceled':
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-sm font-medium">
            <XCircle className="w-4 h-4" />
            {status === 'canceled' ? 'Отменён' : 'Ошибка'}
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-500/20 text-zinc-400 text-sm font-medium">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 w-full max-w-2xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden border border-zinc-700/50">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-zinc-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Платёж #{paymentId}
              </h2>
              {payment && (
                <p className="text-sm text-zinc-500">
                  T-Bank: {payment.tbank_payment_id}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-red-400">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          ) : payment ? (
            <div className="space-y-6">
              {/* Status & Amount */}
              <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-xl">
                <div>
                  <p className="text-sm text-zinc-500 mb-1">Сумма</p>
                  <p className="text-3xl font-bold text-white">
                    {payment.amount.toLocaleString('ru-RU')} ₽
                  </p>
                </div>
                {getStatusBadge(payment.status)}
              </div>

              {/* Main Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-800/50 rounded-xl">
                  <p className="text-xs text-zinc-500 mb-1">Тариф</p>
                  <p className="text-white font-medium">
                    {payment.tier_id} ({payment.photo_count} фото)
                  </p>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-xl">
                  <p className="text-xs text-zinc-500 mb-1">Email</p>
                  <p className="text-white font-medium">
                    {payment.email || '—'}
                  </p>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-xl">
                  <p className="text-xs text-zinc-500 mb-1">Создан</p>
                  <p className="text-white font-medium">
                    {formatDate(payment.created_at)}
                  </p>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-xl">
                  <p className="text-xs text-zinc-500 mb-1">Обновлён</p>
                  <p className="text-white font-medium">
                    {formatDate(payment.updated_at)}
                  </p>
                </div>
              </div>

              {/* User Info */}
              <div className="p-4 bg-zinc-800/50 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <User className="w-4 h-4 text-zinc-500" />
                  <p className="text-sm font-medium text-white">Пользователь</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-zinc-500">ID</p>
                    <p className="text-white">{payment.user_id}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Telegram ID</p>
                    <p className="text-white font-mono">{payment.telegram_user_id}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Pro статус</p>
                    <p className={payment.user_is_pro ? 'text-emerald-400' : 'text-zinc-400'}>
                      {payment.user_is_pro ? 'Активен' : 'Нет'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Avatar Info */}
              {payment.avatar_id && (
                <div className="p-4 bg-zinc-800/50 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <Image className="w-4 h-4 text-zinc-500" />
                    <p className="text-sm font-medium text-white">Аватар</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-zinc-500">Название</p>
                      <p className="text-white">{payment.avatar_name || `#${payment.avatar_id}`}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Статус</p>
                      <p className="text-white">{payment.avatar_status || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Фото сгенерировано</p>
                      <p className="text-white">{payment.photos_generated}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Info */}
              {(payment.error_code || payment.error_message) && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <p className="text-sm font-medium text-red-400">Ошибка</p>
                  </div>
                  {payment.error_code && (
                    <p className="text-sm text-red-400/80">
                      <strong>Код:</strong> {payment.error_code}
                    </p>
                  )}
                  {payment.error_message && (
                    <p className="text-sm text-red-400/80 mt-1">
                      {payment.error_message}
                    </p>
                  )}
                </div>
              )}

              {/* Refund Info */}
              {payment.refund_id && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <Undo2 className="w-4 h-4 text-blue-400" />
                    <p className="text-sm font-medium text-blue-400">Возврат</p>
                  </div>
                  <p className="text-sm text-blue-400/80">
                    <strong>ID:</strong> {payment.refund_id}
                  </p>
                  {payment.refund_reason && (
                    <p className="text-sm text-blue-400/80 mt-1">
                      <strong>Причина:</strong> {payment.refund_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Refund Form */}
              {payment.status === 'succeeded' && !payment.refund_id && (
                <>
                  {!showRefundForm ? (
                    <button
                      onClick={() => setShowRefundForm(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-400 font-medium transition-colors"
                    >
                      <Undo2 className="w-4 h-4" />
                      Сделать возврат
                    </button>
                  ) : (
                    <div className="p-4 bg-zinc-800/50 rounded-xl space-y-4">
                      <p className="text-sm font-medium text-white">Оформить возврат</p>
                      <textarea
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        placeholder="Причина возврата..."
                        className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-pink-500 resize-none"
                        rows={3}
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setShowRefundForm(false)
                            setRefundReason('')
                          }}
                          className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-zinc-300 transition-colors"
                        >
                          Отмена
                        </button>
                        <button
                          onClick={handleRefund}
                          disabled={!refundReason.trim() || refunding}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {refunding ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Undo2 className="w-4 h-4" />
                          )}
                          Вернуть {payment.amount} ₽
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
