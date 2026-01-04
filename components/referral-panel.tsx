"use client"

import React, { useState, useEffect } from "react"
import {
  Gift, Copy, Check, Users, Wallet, TrendingUp, ArrowRight,
  Loader2, X, CreditCard, Phone, AlertCircle, ChevronDown, Send,
  Star, Crown, ExternalLink, Clock
} from "lucide-react"

interface ReferralStats {
  code: string | null
  balance: number
  totalEarned: number
  totalWithdrawn: number
  referralsCount: number
  pendingWithdrawal: number
  canWithdraw?: boolean
  minWithdrawal?: number
  payoutPreview?: {
    amount: number
    ndfl: number
    payout: number
  } | null
  // Partner data
  isPartner?: boolean
  commissionRate?: number
  commissionPercent?: number
}

interface PartnerStatus {
  isPartner: boolean
  commissionRate: number
  commissionPercent: number
  canApply: boolean
  application?: {
    id: number
    status: "pending" | "approved" | "rejected"
    createdAt: string
    rejectionReason?: string
  } | null
}

interface ReferralEarning {
  id: number
  amount: number
  originalAmount: number
  createdAt: string
}

interface WithdrawalPreview {
  amount: number
  ndflAmount: number
  payoutAmount: number
  minWithdrawal: number
  canWithdraw: boolean
}

interface ReferralPanelProps {
  telegramUserId?: number
  isOpen: boolean
  onClose: () => void
}

export function ReferralPanel({ telegramUserId, isOpen, onClose }: ReferralPanelProps) {
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [earnings, setEarnings] = useState<ReferralEarning[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [showEarnings, setShowEarnings] = useState(false)
  const [copiedTelegram, setCopiedTelegram] = useState(false)
  const [partnerStatus, setPartnerStatus] = useState<PartnerStatus | null>(null)
  const [showPartnerForm, setShowPartnerForm] = useState(false)

  useEffect(() => {
    if (isOpen && telegramUserId) {
      fetchStats()
      fetchPartnerStatus()
    }
  }, [isOpen, telegramUserId])

  const fetchPartnerStatus = async () => {
    try {
      if (!telegramUserId) return
      const res = await fetch(`/api/partner/status?telegram_user_id=${telegramUserId}`)
      const data = await res.json()
      if (data.success) {
        setPartnerStatus({
          isPartner: data.isPartner,
          commissionRate: data.commissionRate,
          commissionPercent: data.commissionPercent,
          canApply: data.canApply,
          application: data.application,
        })
      }
    } catch {
      // Partner status fetch failed silently
    }
  }

  const fetchStats = async () => {
    setLoading(true)
    setError(null)
    try {
      if (!telegramUserId) {
        setError("Telegram ID отсутствует")
        return
      }
      const res = await fetch(`/api/referral/stats?telegram_user_id=${telegramUserId}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || `Ошибка: ${res.status}`)
        return
      }

      if (data.success) {
        // API возвращает данные на верхнем уровне, не в stats
        setStats({
          code: data.code,
          balance: data.balance,
          totalEarned: data.totalEarned,
          totalWithdrawn: data.totalWithdrawn,
          referralsCount: data.referralsCount,
          pendingWithdrawal: data.pendingWithdrawal,
          canWithdraw: data.canWithdraw,
          minWithdrawal: data.minWithdrawal,
          payoutPreview: data.payoutPreview,
        })
      } else {
        setError(data.error || "Не удалось загрузить данные")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети")
    } finally {
      setLoading(false)
    }
  }

  const fetchEarnings = async () => {
    try {
      const res = await fetch(`/api/referral/earnings?telegram_user_id=${telegramUserId}`)
      const data = await res.json()
      if (data.success && Array.isArray(data.earnings)) {
        setEarnings(data.earnings)
      }
    } catch {
      // Earnings fetch failed silently
    }
  }

  const copyTelegramLink = async () => {
    if (!stats?.code) return
    const sanitizedCode = encodeURIComponent(stats.code)
    const telegramDeeplink = `https://t.me/Pinglass_bot/Pinglass?startapp=${sanitizedCode}`

    try {
      // Try Telegram WebApp API first (works in Telegram Mini Apps)
      const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void; showAlert?: (msg: string) => void } } }).Telegram?.WebApp

      // Try modern clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(telegramDeeplink)
        setCopiedTelegram(true)
        setTimeout(() => setCopiedTelegram(false), 2000)
        return
      }

      // Fallback: create temporary textarea
      const textArea = document.createElement('textarea')
      textArea.value = telegramDeeplink
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      textArea.style.top = '-9999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()

      const success = document.execCommand('copy')
      document.body.removeChild(textArea)

      if (success) {
        setCopiedTelegram(true)
        setTimeout(() => setCopiedTelegram(false), 2000)
      } else if (tg?.showAlert) {
        try {
          tg.showAlert('Скопируйте ссылку вручную: ' + telegramDeeplink)
        } catch {
          alert('Не удалось скопировать. Ссылка: ' + telegramDeeplink)
        }
      } else {
        alert('Не удалось скопировать. Ссылка: ' + telegramDeeplink)
      }
    } catch {
      // Last resort - show the link
      alert('Ссылка для копирования:\n' + telegramDeeplink)
    }
  }

  const shareTelegram = () => {
    if (!stats?.code) return
    const sanitizedCode = encodeURIComponent(stats.code)
    const telegramDeeplink = `https://t.me/Pinglass_bot/Pinglass?startapp=${sanitizedCode}`
    const shareText = 'Создай свои AI-фотографии в PinGlass!'

    try {
      // Check for Telegram WebApp API
      const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void; switchInlineQuery?: (query: string, chatTypes?: string[]) => void } } }).Telegram?.WebApp

      if (tg?.openTelegramLink) {
        // Use Telegram's native share via openTelegramLink
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(telegramDeeplink)}&text=${encodeURIComponent(shareText)}`
        try {
          tg.openTelegramLink(shareUrl)
          return
        } catch {
          // Fall through to window.open fallback
        }
      }

      // Fallback: regular window.open
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(telegramDeeplink)}&text=${encodeURIComponent(shareText)}`
      const popup = window.open(shareUrl, '_blank', 'noopener,noreferrer')

      // If popup was blocked, try location change
      if (!popup || popup.closed) {
        window.location.href = shareUrl
      }
    } catch {
      // Fallback to direct navigation
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(telegramDeeplink)}&text=${encodeURIComponent(shareText)}`
      window.location.href = shareUrl
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-background rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-hidden shadow-2xl border border-border animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-xl z-10 px-4 sm:px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${
                partnerStatus?.isPartner
                  ? "bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/30"
                  : "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30"
              }`}>
                {partnerStatus?.isPartner ? (
                  <Crown className="w-5 h-5 text-white" />
                ) : (
                  <Gift className="w-5 h-5 text-white" />
                )}
              </div>
              <div>
                <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
                  {partnerStatus?.isPartner ? "Партнёр" : "Реферальная программа"}
                  {partnerStatus?.isPartner && (
                    <span className="text-xs px-2 py-0.5 bg-violet-500/20 text-violet-600 dark:text-violet-400 rounded-full">
                      50%
                    </span>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {partnerStatus?.isPartner
                    ? "Зарабатывайте 50% с каждого реферала"
                    : "Зарабатывайте 10% с каждого реферала"
                  }
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 py-4 overflow-y-auto max-h-[calc(90vh-80px)] space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : stats ? (
            <>
              {/* Telegram Referral Link */}
              <div className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-2xl border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Send className="w-4 h-4 text-blue-500" />
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Telegram ссылка:</p>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="text"
                      readOnly
                      value={`https://t.me/Pinglass_bot/Pinglass?startapp=${encodeURIComponent(stats.code || "")}`}
                      className="flex-1 min-w-0 px-3 py-2 bg-blue-500/5 rounded-xl text-sm text-foreground truncate border border-blue-500/10"
                    />
                    <button
                      onClick={copyTelegramLink}
                      className="shrink-0 w-10 h-10 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center"
                    >
                      {copiedTelegram ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      
                    </button>
                  </div>
                  <button
                    onClick={shareTelegram}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
                  >
                    <Send className="w-4 h-4" />
                    Поделиться в Telegram
                  </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-card rounded-2xl border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Wallet className="w-4 h-4" />
                    <span className="text-xs">Баланс</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.balance.toLocaleString("ru-RU")} ₽
                  </p>
                </div>
                <div className="p-4 bg-card rounded-2xl border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Users className="w-4 h-4" />
                    <span className="text-xs">Рефералов</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.referralsCount}
                  </p>
                </div>
                <div className="p-4 bg-card rounded-2xl border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs">Всего заработано</span>
                  </div>
                  <p className="text-xl font-bold text-green-600">
                    {stats.totalEarned.toLocaleString("ru-RU")} ₽
                  </p>
                </div>
                <div className="p-4 bg-card rounded-2xl border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-xs">Выведено</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">
                    {stats.totalWithdrawn.toLocaleString("ru-RU")} ₽
                  </p>
                </div>
              </div>

              {/* Earnings History Toggle */}
              <button
                onClick={() => {
                  setShowEarnings(!showEarnings)
                  if (!showEarnings && earnings.length === 0) fetchEarnings()
                }}
                className="w-full p-4 bg-card rounded-2xl border border-border flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm font-medium text-foreground">История начислений</span>
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${showEarnings ? "rotate-180" : ""}`} />
              </button>

              {/* Earnings List */}
              {showEarnings && (
                <div className="space-y-2">
                  {earnings.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Пока нет начислений
                    </p>
                  ) : (
                    earnings.slice(0, 10).map((earning) => {
                      const percent = earning.originalAmount > 0
                        ? Math.round((earning.amount / earning.originalAmount) * 100)
                        : 10
                      return (
                        <div
                          key={earning.id}
                          className="p-3 bg-muted/50 rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              +{earning.amount.toLocaleString("ru-RU")} ₽
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {percent}% от {earning.originalAmount.toLocaleString("ru-RU")} ₽
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(earning.createdAt).toLocaleDateString("ru-RU")}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* Withdrawal Info */}
              <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Вывод от 5 000 ₽
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      При выводе удерживается НДФЛ 13%. Вы получите 87% от суммы.
                    </p>
                  </div>
                </div>
              </div>

              {/* Partner Section */}
              {partnerStatus && !partnerStatus.isPartner && (
                <div className="p-4 bg-gradient-to-br from-violet-500/10 to-purple-600/5 rounded-2xl border border-violet-500/20">
                  {partnerStatus.application?.status === "pending" ? (
                    // Pending application
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="font-medium text-violet-800 dark:text-violet-200">
                          Заявка на рассмотрении
                        </p>
                        <p className="text-xs text-violet-700 dark:text-violet-300 mt-1">
                          Подана {new Date(partnerStatus.application.createdAt).toLocaleDateString("ru-RU")}.
                          Обычно рассмотрение занимает 1-2 рабочих дня.
                        </p>
                      </div>
                    </div>
                  ) : partnerStatus.application?.status === "rejected" ? (
                    // Rejected application
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-red-800 dark:text-red-200">
                          Заявка отклонена
                        </p>
                        {partnerStatus.application.rejectionReason && (
                          <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                            Причина: {partnerStatus.application.rejectionReason}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : partnerStatus.canApply ? (
                    // Can apply
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <Crown className="w-4 h-4 text-violet-600" />
                        <p className="text-sm font-medium text-violet-800 dark:text-violet-200">
                          Станьте партнёром — получайте 50%
                        </p>
                      </div>
                      <p className="text-xs text-violet-700 dark:text-violet-300 mb-3">
                        Партнёры получают повышенную комиссию 50% вместо стандартных 10% за каждого приведённого пользователя.
                      </p>
                      <button
                        onClick={() => setShowPartnerForm(true)}
                        className="w-full py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25"
                      >
                        <Star className="w-4 h-4" />
                        Стать партнёром
                      </button>
                    </>
                  ) : null}
                </div>
              )}

              {/* Withdraw Button */}
              <button
                onClick={() => stats.balance >= 5000 && setShowWithdrawModal(true)}
                disabled={stats.balance < 5000}
                className="w-full py-4 bg-gradient-to-r from-primary to-accent text-white font-semibold rounded-2xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
              >
                <Wallet className="w-5 h-5" />
                {stats.balance >= 5000
                  ? `Вывести ${stats.balance.toLocaleString("ru-RU")} ₽`
                  : `Нужно ещё ${(5000 - stats.balance).toLocaleString("ru-RU")} ₽`}
              </button>
            </>
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{error || "Не удалось загрузить данные"}</p>
              <button
                onClick={fetchStats}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm"
              >
                Повторить
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && stats && (
        <WithdrawModal
          telegramUserId={telegramUserId}
          balance={stats.balance}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={() => {
            setShowWithdrawModal(false)
            fetchStats()
          }}
        />
      )}

      {/* Partner Application Modal */}
      {showPartnerForm && (
        <PartnerApplicationModal
          telegramUserId={telegramUserId}
          onClose={() => setShowPartnerForm(false)}
          onSuccess={() => {
            setShowPartnerForm(false)
            fetchPartnerStatus()
          }}
        />
      )}
    </div>
  )
}

function WithdrawModal({
  telegramUserId,
  balance,
  onClose,
  onSuccess
}: {
  telegramUserId?: number
  balance: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [method, setMethod] = useState<"card" | "sbp">("card")
  const [cardNumber, setCardNumber] = useState("")
  const [phone, setPhone] = useState("")
  const [recipientName, setRecipientName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const ndflAmount = Math.round(balance * 0.13)
  const payoutAmount = balance - ndflAmount

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16)
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ")
  }

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11)
    if (digits.length === 0) return ""
    if (digits.length <= 1) return `+${digits}`
    if (digits.length <= 4) return `+${digits.slice(0, 1)} (${digits.slice(1)}`
    if (digits.length <= 7) return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4)}`
    if (digits.length <= 9) return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
    return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`
  }

  const handleSubmit = async () => {
    setError("")

    if (!recipientName.trim()) {
      setError("Введите ФИО получателя")
      return
    }

    if (method === "card" && cardNumber.replace(/\s/g, "").length !== 16) {
      setError("Введите корректный номер карты")
      return
    }

    if (method === "sbp" && phone.replace(/\D/g, "").length !== 11) {
      setError("Введите корректный номер телефона")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/referral/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId,
          amount: balance,
          payoutMethod: method,
          cardNumber: method === "card" ? cardNumber.replace(/\s/g, "") : undefined,
          phone: method === "sbp" ? phone.replace(/\D/g, "") : undefined,
          recipientName: recipientName.trim()
        })
      })

      const data = await res.json()
      if (data.success) {
        onSuccess()
      } else {
        setError(data.error || "Ошибка при создании заявки")
      }
    } catch (e) {
      setError("Ошибка сети")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background rounded-3xl p-6 shadow-2xl border border-border">
        <h3 className="text-xl font-bold text-foreground mb-4">Вывод средств</h3>

        {/* Amount Preview */}
        <div className="p-4 bg-muted rounded-2xl mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Сумма вывода:</span>
            <span className="font-medium">{balance.toLocaleString("ru-RU")} ₽</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">НДФЛ 13%:</span>
            <span className="text-red-500">-{ndflAmount.toLocaleString("ru-RU")} ₽</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between">
            <span className="font-medium">К получению:</span>
            <span className="text-xl font-bold text-green-600">{payoutAmount.toLocaleString("ru-RU")} ₽</span>
          </div>
        </div>

        {/* Method Selection */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMethod("card")}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              method === "card"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            На карту
          </button>
          <button
            onClick={() => setMethod("sbp")}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              method === "sbp"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <Phone className="w-4 h-4" />
            СБП
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-3 mb-4">
          {method === "card" ? (
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Номер карты</label>
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="0000 0000 0000 0000"
                className="w-full px-4 py-3 bg-muted rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          ) : (
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Номер телефона</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="+7 (900) 123-45-67"
                className="w-full px-4 py-3 bg-muted rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">ФИО получателя</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Иванов Иван Иванович"
              className="w-full px-4 py-3 bg-muted rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Для 6-НДФЛ отчётности
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-muted text-muted-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <ArrowRight className="w-5 h-5" />
                Отправить
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function PartnerApplicationModal({
  telegramUserId,
  onClose,
  onSuccess
}: {
  telegramUserId?: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    telegramUsername: "",
    audienceSize: "",
    audienceType: "",
    promotionChannels: "",
    websiteUrl: "",
    message: "",
  })

  const audienceSizes = [
    { value: "1000-5000", label: "1 000 — 5 000" },
    { value: "5000-10000", label: "5 000 — 10 000" },
    { value: "10000-50000", label: "10 000 — 50 000" },
    { value: "50000-100000", label: "50 000 — 100 000" },
    { value: "100000+", label: "100 000+" },
  ]

  const audienceTypes = [
    { value: "telegram", label: "Telegram-канал" },
    { value: "instagram", label: "Instagram" },
    { value: "youtube", label: "YouTube" },
    { value: "blog", label: "Блог/Сайт" },
    { value: "other", label: "Другое" },
  ]

  const handleSubmit = async () => {
    setError("")

    if (!formData.contactName.trim()) {
      setError("Введите имя")
      return
    }

    if (!formData.audienceSize) {
      setError("Выберите размер аудитории")
      return
    }

    if (!formData.audienceType) {
      setError("Выберите тип площадки")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/partner/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId,
          ...formData,
        })
      })

      const data = await res.json()
      if (data.success) {
        onSuccess()
      } else {
        setError(data.error || "Ошибка при подаче заявки")
      }
    } catch {
      setError("Ошибка сети")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background rounded-3xl shadow-2xl border border-border max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-xl z-10 px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Стать партнёром</h3>
                <p className="text-xs text-muted-foreground">Комиссия 50% с продаж</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-xl text-muted-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
          {/* Contact Name */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Имя *</label>
            <input
              type="text"
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              placeholder="Как к вам обращаться"
              className="w-full px-4 py-3 bg-muted rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Contact Email */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Email</label>
            <input
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              placeholder="email@example.com"
              className="w-full px-4 py-3 bg-muted rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Telegram Username */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Telegram</label>
            <input
              type="text"
              value={formData.telegramUsername}
              onChange={(e) => setFormData({ ...formData, telegramUsername: e.target.value })}
              placeholder="@username"
              className="w-full px-4 py-3 bg-muted rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Audience Size */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Размер аудитории *</label>
            <select
              value={formData.audienceSize}
              onChange={(e) => setFormData({ ...formData, audienceSize: e.target.value })}
              className="w-full px-4 py-3 bg-muted rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Выберите...</option>
              {audienceSizes.map((size) => (
                <option key={size.value} value={size.value}>{size.label}</option>
              ))}
            </select>
          </div>

          {/* Audience Type */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Тип площадки *</label>
            <select
              value={formData.audienceType}
              onChange={(e) => setFormData({ ...formData, audienceType: e.target.value })}
              className="w-full px-4 py-3 bg-muted rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Выберите...</option>
              {audienceTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* Website URL */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Ссылка на площадку</label>
            <input
              type="url"
              value={formData.websiteUrl}
              onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
              placeholder="https://t.me/channel или https://instagram.com/..."
              className="w-full px-4 py-3 bg-muted rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Message */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Комментарий</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Расскажите о себе и как планируете продвигать PinGlass"
              rows={3}
              className="w-full px-4 py-3 bg-muted rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Info */}
          <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl">
            <p className="text-xs text-violet-700 dark:text-violet-300">
              После подачи заявки мы свяжемся с вами в течение 1-2 рабочих дней.
              При одобрении ваша комиссия автоматически увеличится до 50%.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur-xl px-6 py-4 border-t border-border">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-muted text-muted-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ArrowRight className="w-5 h-5" />
                  Отправить
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReferralPanel
