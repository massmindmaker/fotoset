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
  Undo2,
  Copy,
  Check
} from 'lucide-react'

interface PaymentDetailsModalProps {
  paymentId: number | null
  isOpen: boolean
  onClose: () => void
  onRefund?: () => void
}

interface PaymentDetails {
  id: number
  tbank_payment_id: string | null
  provider_payment_id: string | null
  user_id: number
  telegram_user_id: string
  telegram_username: string | null
  amount: number
  currency: string
  tier_id: string
  photo_count: number
  status: string
  refund_status: string | null
  refund_amount: number | null
  refund_reason: string | null
  refund_at: string | null
  is_test_mode: boolean
  generation_consumed: boolean
  consumed_at: string | null
  created_at: string
  updated_at: string
  // Related data
  avatar_id: number | null
  avatar_name: string | null
  avatar_status: string | null
  photos_generated: number
  // Provider-specific fields
  provider: 'tbank' | 'stars' | 'ton'
  original_amount: number | null
  original_currency: string | null
  exchange_rate: number | null
  rate_locked_at: string | null
  rate_expires_at: string | null
  telegram_charge_id: string | null
  stars_amount: number | null
  ton_tx_hash: string | null
  ton_amount: number | null
  ton_sender_address: string | null
  ton_confirmations: number | null
}

export function PaymentDetailsModal({ paymentId, isOpen, onClose, onRefund }: PaymentDetailsModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payment, setPayment] = useState<PaymentDetails | null>(null)
  const [refunding, setRefunding] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [showRefundForm, setShowRefundForm] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Успешно
          </span>
        )
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
            <Clock className="w-4 h-4" />
            В обработке
          </span>
        )
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
            <Undo2 className="w-4 h-4" />
            Возвращён
          </span>
        )
      case 'canceled':
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-medium">
            <XCircle className="w-4 h-4" />
            {status === 'canceled' ? 'Отменён' : 'Ошибка'}
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-sm font-medium">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Платёж #{paymentId}
              </h2>
              {payment && (
                <p className="text-sm text-slate-500">
                  {payment.provider === 'tbank' && payment.tbank_payment_id && `T-Bank: ${payment.tbank_payment_id}`}
                  {payment.provider === 'stars' && payment.telegram_charge_id && `Stars: ${payment.telegram_charge_id}`}
                  {payment.provider === 'ton' && payment.ton_tx_hash && `TON: ${payment.ton_tx_hash.slice(0, 16)}...`}
                  {!payment.tbank_payment_id && !payment.telegram_charge_id && !payment.ton_tx_hash && `Provider: ${payment.provider}`}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
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
            <div className="flex items-center justify-center py-12 text-red-600">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          ) : payment ? (
            <div className="space-y-6">
              {/* Status & Amount */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Сумма</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {payment.amount.toLocaleString('ru-RU')} ₽
                  </p>
                </div>
                {getStatusBadge(payment.status)}
              </div>

              {/* Main Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Тариф</p>
                  <p className="text-slate-900 font-medium">
                    {payment.tier_id} ({payment.photo_count} фото)
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Режим</p>
                  <p className="text-slate-900 font-medium">
                    {payment.is_test_mode ? 'Тестовый' : 'Боевой'}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Создан</p>
                  <p className="text-slate-900 font-medium">
                    {formatDate(payment.created_at)}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Обновлён</p>
                  <p className="text-slate-900 font-medium">
                    {formatDate(payment.updated_at)}
                  </p>
                </div>
              </div>

              {/* User Info */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                  <User className="w-4 h-4 text-slate-500" />
                  <p className="text-sm font-medium text-slate-900">Пользователь</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">ID</p>
                    <p className="text-slate-900">{payment.user_id}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Telegram ID</p>
                    <p className="text-slate-900 font-mono">{payment.telegram_user_id}</p>
                  </div>
                  {payment.telegram_username && (
                    <div className="col-span-2">
                      <p className="text-slate-500">Telegram Username</p>
                      <p className="text-slate-900">@{payment.telegram_username}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Avatar Info */}
              {payment.avatar_id && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3 mb-3">
                    <Image className="w-4 h-4 text-slate-500" />
                    <p className="text-sm font-medium text-slate-900">Аватар</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Название</p>
                      <p className="text-slate-900">{payment.avatar_name || `#${payment.avatar_id}`}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Статус</p>
                      <p className="text-slate-900">{payment.avatar_status || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Фото сгенерировано</p>
                      <p className="text-slate-900">{payment.photos_generated}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Provider Details */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                  <CreditCard className="w-4 h-4 text-slate-500" />
                  <p className="text-sm font-medium text-slate-900">Детали провайдера</p>
                  <span className="px-2 py-0.5 bg-slate-200 rounded text-xs font-medium text-slate-600 uppercase">
                    {payment.provider || 'tbank'}
                  </span>
                </div>

                {(payment.provider === 'tbank' || !payment.provider) && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">T-Bank ID:</span>
                      <span className="font-mono text-slate-900">{payment.tbank_payment_id}</span>
                    </div>
                  </div>
                )}

                {payment.provider === 'stars' && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Telegram Charge ID:</span>
                      <span className="font-mono text-slate-900">{payment.telegram_charge_id || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Сумма в Stars:</span>
                      <span className="text-slate-900">&#11088; {payment.stars_amount || payment.original_amount}</span>
                    </div>
                    {payment.exchange_rate && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Курс:</span>
                        <span className="text-slate-900">{payment.exchange_rate} RUB/Star</span>
                      </div>
                    )}
                  </div>
                )}

                {payment.provider === 'ton' && (
                  <div className="space-y-2 text-sm">
                    {payment.ton_tx_hash && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">TX Hash:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-900">
                            {payment.ton_tx_hash.slice(0, 16)}...
                          </span>
                          <button
                            onClick={() => copyToClipboard(payment.ton_tx_hash!, 'ton_tx_hash')}
                            className="p-1 hover:bg-slate-200 rounded transition-colors"
                            title="Копировать"
                          >
                            {copiedField === 'ton_tx_hash' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Сумма TON:</span>
                      <span className="text-slate-900">&#128142; {payment.ton_amount}</span>
                    </div>
                    {payment.ton_sender_address && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Отправитель:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-900">
                            {payment.ton_sender_address.slice(0, 12)}...
                          </span>
                          <button
                            onClick={() => copyToClipboard(payment.ton_sender_address!, 'ton_sender')}
                            className="p-1 hover:bg-slate-200 rounded transition-colors"
                            title="Копировать"
                          >
                            {copiedField === 'ton_sender' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Подтверждений:</span>
                      <span className="text-slate-900">{payment.ton_confirmations ?? 0}</span>
                    </div>
                    {payment.exchange_rate && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Курс:</span>
                        <span className="text-slate-900">{payment.exchange_rate} RUB/TON</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Generation Status */}
              {payment.generation_consumed && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <p className="text-sm font-medium text-emerald-700">Генерация использована</p>
                  </div>
                  {payment.consumed_at && (
                    <p className="text-sm text-emerald-600">
                      {formatDate(payment.consumed_at)}
                    </p>
                  )}
                </div>
              )}

              {/* Refund Info */}
              {payment.refund_status && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <Undo2 className="w-4 h-4 text-blue-600" />
                    <p className="text-sm font-medium text-blue-700">Возврат</p>
                  </div>
                  <p className="text-sm text-blue-600">
                    <strong>Статус:</strong> {payment.refund_status}
                  </p>
                  {payment.refund_amount && (
                    <p className="text-sm text-blue-600 mt-1">
                      <strong>Сумма:</strong> {payment.refund_amount} ₽
                    </p>
                  )}
                  {payment.refund_reason && (
                    <p className="text-sm text-blue-600 mt-1">
                      <strong>Причина:</strong> {payment.refund_reason}
                    </p>
                  )}
                  {payment.refund_at && (
                    <p className="text-sm text-blue-600 mt-1">
                      <strong>Дата:</strong> {formatDate(payment.refund_at)}
                    </p>
                  )}
                </div>
              )}

              {/* Refund Form */}
              {payment.status === 'succeeded' && !payment.refund_status && (
                <>
                  {!showRefundForm ? (
                    <button
                      onClick={() => setShowRefundForm(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-red-600 font-medium transition-colors"
                    >
                      <Undo2 className="w-4 h-4" />
                      Сделать возврат
                    </button>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                      <p className="text-sm font-medium text-slate-900">Оформить возврат</p>
                      <textarea
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        placeholder="Причина возврата..."
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 resize-none"
                        rows={3}
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setShowRefundForm(false)
                            setRefundReason('')
                          }}
                          className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
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
