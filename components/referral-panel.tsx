"use client"

import React, { useState, useEffect } from "react"
import {
  Gift, Copy, Check, Users, Wallet, TrendingUp, ArrowRight,
  Loader2, X, CreditCard, Phone, AlertCircle, ChevronDown, Send
} from "lucide-react"

interface ReferralStats {
  code: string
  balance: number
  totalEarned: number
  totalWithdrawn: number
  referralsCount: number
  pendingWithdrawal: number
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
  deviceId: string
  isOpen: boolean
  onClose: () => void
}

export function ReferralPanel({ deviceId, isOpen, onClose }: ReferralPanelProps) {
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [earnings, setEarnings] = useState<ReferralEarning[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [showEarnings, setShowEarnings] = useState(false)
  const [copiedTelegram, setCopiedTelegram] = useState(false)

  useEffect(() => {
    if (isOpen && deviceId) {
      fetchStats()
    }
  }, [isOpen, deviceId])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/referral/stats?device_id=${deviceId}`)
      const data = await res.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (e) {
      console.error("Failed to fetch referral stats:", e)
    } finally {
      setLoading(false)
    }
  }

  const fetchEarnings = async () => {
    try {
      const res = await fetch(`/api/referral/earnings?device_id=${deviceId}`)
      const data = await res.json()
      if (data.success) {
        setEarnings(data.earnings)
      }
    } catch (e) {
      console.error("Failed to fetch earnings:", e)
    }
  }

  const copyLink = async () => {
    if (!stats?.code) return
    const link = `${window.location.origin}/?ref=${stats.code}`
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyCode = async () => {
    if (!stats?.code) return
    await navigator.clipboard.writeText(stats.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyTelegramLink = async () => {
    if (!stats?.code) return
    // URL encode referral code to handle special characters safely
    const sanitizedCode = encodeURIComponent(stats.code)
    const telegramDeeplink = `https://t.me/Pinglass_bot/Pinglass?startapp=${sanitizedCode}`
    await navigator.clipboard.writeText(telegramDeeplink)
    setCopiedTelegram(true)
    setTimeout(() => setCopiedTelegram(false), 2000)
  }

  const shareTelegram = () => {
    if (!stats?.code) return
    // URL encode referral code to handle special characters safely
    const sanitizedCode = encodeURIComponent(stats.code)
    const telegramDeeplink = `https://t.me/Pinglass_bot/Pinglass?startapp=${sanitizedCode}`
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(telegramDeeplink)}&text=${encodeURIComponent('Создай свои AI-фотографии в PinGlass!')}`
    window.open(shareUrl, '_blank')
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
        <div className="sticky top-0 bg-background/95 backdrop-blur-xl z-10 px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Gift className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-foreground">Партнёрская программа</h2>
                <p className="text-xs text-muted-foreground">Зарабатывайте 10% с каждого реферала</p>
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
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-80px)] space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : stats ? (
            <>
              {/* Referral Code */}
              <div className="p-4 bg-gradient-to-br from-primary/10 to-accent/5 rounded-2xl border border-primary/20">
                <p className="text-sm text-muted-foreground mb-2">Ваш код:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-2xl font-mono font-bold text-foreground tracking-wider">
                    {stats.code}
                  </code>
                  <button
                    onClick={copyCode}
                    className="p-2.5 bg-primary/10 hover:bg-primary/20 rounded-xl text-primary transition-colors"
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Share Links */}
              <div className="space-y-3">
                {/* Web Link */}
                <div className="p-4 bg-card rounded-2xl border border-border">
                  <p className="text-sm text-muted-foreground mb-2">Веб-ссылка:</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${stats.code}`}
                      className="flex-1 px-3 py-2 bg-muted rounded-xl text-sm text-foreground truncate"
                    />
                    <button
                      onClick={copyLink}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Скопировано" : "Копировать"}
                    </button>
                  </div>
                </div>

                {/* Telegram Link */}
                <div className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-2xl border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Send className="w-4 h-4 text-blue-500" />
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Telegram ссылка:</p>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="text"
                      readOnly
                      value={`https://t.me/Pinglass_bot/Pinglass?startapp=${encodeURIComponent(stats.code)}`}
                      className="flex-1 px-3 py-2 bg-blue-500/5 rounded-xl text-sm text-foreground truncate border border-blue-500/10"
                    />
                    <button
                      onClick={copyTelegramLink}
                      className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
                    >
                      {copiedTelegram ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedTelegram ? "Скопировано" : "Копировать"}
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
                    earnings.slice(0, 10).map((earning) => (
                      <div
                        key={earning.id}
                        className="p-3 bg-muted/50 rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            +{earning.amount.toLocaleString("ru-RU")} ₽
                          </p>
                          <p className="text-xs text-muted-foreground">
                            10% от {earning.originalAmount.toLocaleString("ru-RU")} ₽
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(earning.createdAt).toLocaleDateString("ru-RU")}
                        </p>
                      </div>
                    ))
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
              <p className="text-muted-foreground">Не удалось загрузить данные</p>
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
          deviceId={deviceId}
          balance={stats.balance}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={() => {
            setShowWithdrawModal(false)
            fetchStats()
          }}
        />
      )}
    </div>
  )
}

function WithdrawModal({
  deviceId,
  balance,
  onClose,
  onSuccess
}: {
  deviceId: string
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
          deviceId,
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

export default ReferralPanel
