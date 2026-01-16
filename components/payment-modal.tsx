"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { X, Check, Loader2, Mail, ShieldCheck, CreditCard, Coins, Star, Image } from "lucide-react"
import { extractErrorMessage, getErrorMessage } from "@/lib/error-utils"
import { usePaymentMethods } from "./hooks/usePaymentMethods"
import { usePricing } from "./hooks/usePricing"
import { useTonConnect } from "@/lib/tonconnect/provider"
import { Button } from "@/components/ui/button"

interface PricingTier {
  id: string
  photos: number
  price: number
  originalPrice?: number
  discount?: number
  popular?: boolean
}

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  telegramUserId?: number
  neonUserId?: string
  tier?: PricingTier // Optional - if not provided, show tier selection
  personaId?: string
}

interface PaymentResponse {
  paymentId: string
  confirmationUrl: string
  testMode: boolean
}

// Default tier features for display
const TIER_FEATURES: Record<string, string[]> = {
  starter: ["До 23 фото", "На выбор"],
  standard: ["До 23 фото", "На выбор", "Безопасно"],
  premium: ["До 23 фото", "На выбор", "Фото не сохраняются"],
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  telegramUserId,
  neonUserId,
  tier: initialTier,
  personaId
}) => {
  const [step, setStep] = useState<"FORM" | "PROCESSING" | "REDIRECT" | "SUCCESS" | "ERROR" | "STARS_WAITING" | "TON_PAYMENT">("FORM")
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [selectedMethod, setSelectedMethod] = useState<'tbank' | 'stars' | 'ton'>('tbank')
  const [selectedTierId, setSelectedTierId] = useState<string>(initialTier?.id || 'standard')

  // Stars payment polling
  const [starsPaymentId, setStarsPaymentId] = useState<string | null>(null)
  // TON payment data
  const [tonPaymentData, setTonPaymentData] = useState<{
    walletAddress: string
    amount: number
    comment: string
    paymentId: string
    tonLink: string
  } | null>(null)
  // Flag to auto-proceed with TON payment after wallet connects
  const [pendingTonPayment, setPendingTonPayment] = useState(false)

  // LocalStorage key for persistent TON payment intent
  const PENDING_TON_STORAGE_KEY = 'pinglass_pending_ton_payment'

  // Fetch available payment methods and pricing
  const { methods, altMethodsCount, isLoading: methodsLoading } = usePaymentMethods()
  const { tiers, isLoading: pricingLoading } = usePricing()

  // TonConnect hook
  const { wallet, connect, sendTransaction } = useTonConnect()

  // Check if running in Telegram WebApp
  const isTelegram = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData

  // Get selected tier from pricing or use initial
  const selectedTier = tiers.find(t => t.id === selectedTierId) || initialTier || tiers[1] // Default to standard

  // Handle modal close - clear persistent TON payment intent
  const handleClose = useCallback(() => {
    // Clear localStorage when user explicitly closes the modal
    localStorage.removeItem(PENDING_TON_STORAGE_KEY)
    console.log('[Payment] Modal closed, cleared TON payment intent')
    onClose()
  }, [onClose])

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("FORM")
      setLoading(false)
      setEmailError("")
      setErrorMessage("")
      setStarsPaymentId(null)
      setTonPaymentData(null)
      setPendingTonPayment(false)
      if (initialTier) {
        setSelectedTierId(initialTier.id)
      }
    }
  }, [isOpen, initialTier])

  // Poll Stars payment status
  useEffect(() => {
    if (step !== "STARS_WAITING" || !starsPaymentId) return

    let isCancelled = false
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/payment/stars/status?telegram_user_id=${telegramUserId}&payment_id=${starsPaymentId}`)
        const data = await response.json()

        if (isCancelled) return

        if (data.paid) {
          clearInterval(pollInterval)
          setStep("SUCCESS")
          onSuccess()
        } else if (data.status === 'canceled' || data.status === 'failed') {
          clearInterval(pollInterval)
          setErrorMessage("Платёж отменён или не завершён")
          setStep("ERROR")
        }
      } catch (error) {
        console.error("[Stars] Polling error:", error)
      }
    }, 3000)

    const timeout = setTimeout(() => {
      clearInterval(pollInterval)
      if (!isCancelled && step === "STARS_WAITING") {
        setErrorMessage("Время ожидания платежа истекло")
        setStep("ERROR")
      }
    }, 5 * 60 * 1000)

    return () => {
      isCancelled = true
      clearInterval(pollInterval)
      clearTimeout(timeout)
    }
  }, [step, starsPaymentId, telegramUserId, onSuccess])

  const validateEmail = (value: string): boolean => {
    if (!value.trim()) {
      setEmailError("Введите email для получения чека")
      return false
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      setEmailError("Введите корректный email")
      return false
    }
    setEmailError("")
    return true
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEmail(value)
    if (emailError) {
      validateEmail(value)
    }
  }

  // T-Bank payment handler
  const handleTBankPayment = useCallback(async () => {
    if (!validateEmail(email)) return
    if (!selectedTier) return

    if (!telegramUserId && !neonUserId) {
      setErrorMessage("Требуется авторизация")
      setStep("ERROR")
      return
    }

    setLoading(true)
    setSelectedMethod('tbank')
    setStep("PROCESSING")
    setErrorMessage("")

    try {
      const response = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId,
          neonUserId,
          email: email.trim(),
          tierId: selectedTier.id,
          photoCount: selectedTier.photos,
          avatarId: personaId,
        }),
      })

      const data: PaymentResponse = await response.json()

      if (!response.ok) {
        throw new Error(extractErrorMessage(data, "Ошибка создания платежа"))
      }

      if (data.confirmationUrl) {
        setStep("REDIRECT")
        window.location.href = data.confirmationUrl
      } else {
        throw new Error("Не получен URL для оплаты")
      }
    } catch (error) {
      console.error("Payment error:", error)
      setErrorMessage(getErrorMessage(error, "Произошла ошибка"))
      setStep("ERROR")
    } finally {
      setLoading(false)
    }
  }, [email, telegramUserId, neonUserId, selectedTier, personaId])

  // Stars payment handler
  const handleStarsPayment = useCallback(async () => {
    if (!telegramUserId || !selectedTier) {
      setErrorMessage("Для оплаты Stars требуется Telegram")
      setStep("ERROR")
      return
    }

    setLoading(true)
    setSelectedMethod('stars')
    setStep("PROCESSING")
    setErrorMessage("")

    try {
      const response = await fetch("/api/payment/stars/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId,
          tierId: selectedTier.id,
          photoCount: selectedTier.photos,
          avatarId: personaId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(extractErrorMessage(data, "Ошибка создания платежа"))
      }

      if (data.invoiceUrl) {
        setStep("REDIRECT")
        window.location.href = data.invoiceUrl
      } else {
        setStarsPaymentId(data.paymentId)
        setStep("STARS_WAITING")
      }
    } catch (error) {
      console.error("Stars payment error:", error)
      setErrorMessage(getErrorMessage(error, "Произошла ошибка"))
      setStep("ERROR")
    } finally {
      setLoading(false)
    }
  }, [telegramUserId, selectedTier, personaId])

  // TON payment handler with TonConnect
  const handleTonPayment = useCallback(async () => {
    if (!telegramUserId || !selectedTier) {
      setErrorMessage("Для оплаты TON требуется Telegram")
      setStep("ERROR")
      return
    }

    setLoading(true)
    setSelectedMethod('ton')
    setStep("PROCESSING")
    setErrorMessage("")

    try {
      // First, create TON payment on server to get wallet address
      const response = await fetch("/api/payment/ton/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId,
          tierId: selectedTier.id,
          photoCount: selectedTier.photos,
          avatarId: personaId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(extractErrorMessage(data, "Ошибка создания платежа"))
      }

      if (data.walletAddress) {
        setTonPaymentData({
          walletAddress: data.walletAddress,
          amount: data.tonAmount,
          comment: data.comment,
          paymentId: data.paymentId,
          tonLink: data.tonLink,
        })
        setStep("TON_PAYMENT")
      } else {
        throw new Error("Не получен адрес кошелька")
      }
    } catch (error) {
      console.error("TON payment error:", error)
      setErrorMessage(getErrorMessage(error, "Произошла ошибка"))
      setStep("ERROR")
    } finally {
      setLoading(false)
    }
  }, [telegramUserId, selectedTier, personaId])

  // Check for persistent TON payment intent from localStorage (survives page reload)
  useEffect(() => {
    if (!isOpen || !wallet.connected || wallet.loading) return

    try {
      const stored = localStorage.getItem(PENDING_TON_STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        const age = Date.now() - (data.timestamp || 0)

        // Only proceed if intent is less than 5 minutes old
        if (age < 5 * 60 * 1000) {
          console.log('[Payment] Found persistent TON payment intent, wallet connected, proceeding...', data)

          // Clear the stored intent
          localStorage.removeItem(PENDING_TON_STORAGE_KEY)

          // Set tier if stored
          if (data.tierId) {
            setSelectedTierId(data.tierId)
          }

          // Proceed with TON payment
          setPendingTonPayment(true)
        } else {
          // Intent expired, clean up
          console.log('[Payment] TON payment intent expired, cleaning up')
          localStorage.removeItem(PENDING_TON_STORAGE_KEY)
        }
      }
    } catch (e) {
      console.error('[Payment] Error reading persistent TON intent:', e)
      localStorage.removeItem(PENDING_TON_STORAGE_KEY)
    }
  }, [isOpen, wallet.connected, wallet.loading])

  // Auto-proceed with TON payment when wallet connects (handles both in-memory and restored flags)
  useEffect(() => {
    if (pendingTonPayment && wallet.connected && !wallet.loading && step === "FORM") {
      console.log('[Payment] Wallet connected, auto-starting TON payment')
      setPendingTonPayment(false)
      // Clear localStorage just in case
      localStorage.removeItem(PENDING_TON_STORAGE_KEY)
      handleTonPayment()
    }
  }, [pendingTonPayment, wallet.connected, wallet.loading, step, handleTonPayment])

  // Send TON via TonConnect
  const handleTonConnectSend = useCallback(async () => {
    if (!tonPaymentData || !wallet.connected) return

    setLoading(true)
    try {
      const txHash = await sendTransaction(
        tonPaymentData.walletAddress,
        tonPaymentData.amount,
        tonPaymentData.comment
      )

      if (txHash) {
        setStep("SUCCESS")
        onSuccess()
      } else {
        throw new Error("Транзакция не была отправлена")
      }
    } catch (error) {
      console.error("TonConnect send error:", error)
      setErrorMessage(getErrorMessage(error, "Ошибка отправки транзакции"))
      setStep("ERROR")
    } finally {
      setLoading(false)
    }
  }, [tonPaymentData, wallet.connected, sendTransaction, onSuccess])

  if (!isOpen) return null

  const isLoadingData = methodsLoading || pricingLoading

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      <div
        className="bg-background w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-[var(--shadow-lg)] animate-in slide-in-from-bottom-4 duration-300 modal-content-safe max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 p-4 border-b border-border flex justify-between items-center bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-600" />
            <h2 id="payment-modal-title" className="text-lg font-semibold">Безопасная оплата</h2>
          </div>
          <button
            onClick={handleClose}
            className="min-w-11 min-h-11 p-2.5 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
            disabled={loading}
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 pb-6">
          {step === "FORM" && (
            <div className="space-y-4">
              {/* Tier Selection Cards - Only show if no tier was pre-selected */}
              {!initialTier && (
                <div className="space-y-3">
                  {tiers.map((tier) => (
                    <button
                      key={tier.id}
                      onClick={() => setSelectedTierId(tier.id)}
                      className={`w-full p-4 rounded-2xl border-2 transition-all text-left relative ${
                        selectedTierId === tier.id
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-border hover:border-primary/50 bg-background'
                      }`}
                    >
                      {/* Popular badge */}
                      {tier.popular && (
                        <span className="absolute -top-2 right-4 px-2 py-0.5 bg-primary text-white text-xs font-medium rounded-full">
                          Хит
                        </span>
                      )}

                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl font-bold">{tier.photos} фото</span>
                          </div>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            tier.id === 'starter' ? 'bg-gray-100 text-gray-600' :
                            tier.id === 'standard' ? 'bg-purple-100 text-purple-600' :
                            'bg-amber-100 text-amber-600'
                          }`}>
                            {tier.id === 'starter' ? 'Starter' : tier.id === 'standard' ? 'Standard' : 'Premium'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold">{tier.price}</span>
                          <span className="text-lg text-muted-foreground ml-1">₽</span>
                          {tier.originalPrice && tier.originalPrice > tier.price && (
                            <div className="text-sm text-muted-foreground line-through">
                              {tier.originalPrice} ₽
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Feature tags */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {(TIER_FEATURES[tier.id] || []).map((feature, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 bg-muted rounded-full text-xs text-muted-foreground"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Tier Summary - Show when tier is pre-selected */}
              {initialTier && selectedTier && (
                <div className="p-4 bg-muted/50 rounded-2xl border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Image className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{selectedTier.photos} фотографий</p>
                        <p className="text-sm text-muted-foreground">Выбранный пакет</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{selectedTier.price} ₽</p>
                      {selectedTier.originalPrice && selectedTier.originalPrice > selectedTier.price && (
                        <p className="text-sm text-muted-foreground line-through">{selectedTier.originalPrice} ₽</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Email Input - only for T-Bank */}
              {methods.tbank.enabled && (
                <div className="space-y-2 pt-2">
                  <label htmlFor="payment-email" className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email для чека
                  </label>
                  <input
                    id="payment-email"
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    onBlur={() => email && validateEmail(email)}
                    placeholder="your@email.com"
                    className={`w-full px-4 py-3 rounded-xl border-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                      emailError
                        ? "border-red-500 focus:border-red-500"
                        : "border-border focus:border-primary"
                    }`}
                  />
                  {emailError && (
                    <p role="alert" className="text-red-500 text-xs">{emailError}</p>
                  )}
                </div>
              )}

              {/* Payment Buttons */}
              <div className="space-y-3 pt-4">
                {/* T-Bank (Card) - Always visible */}
                {methods.tbank.enabled && (
                  <Button
                    onClick={handleTBankPayment}
                    disabled={loading || isLoadingData}
                    className="w-full h-14 rounded-xl text-base font-semibold bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] hover:from-[#FF5252] hover:to-[#FF7043] text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    {loading && selectedMethod === 'tbank' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Оплатить картой {selectedTier?.price || 0} ₽
                      </>
                    )}
                  </Button>
                )}

                {/* Stars - Only in Telegram */}
                {methods.stars.enabled && isTelegram && (
                  <Button
                    onClick={handleStarsPayment}
                    disabled={loading || isLoadingData}
                    variant="outline"
                    className="w-full h-14 rounded-xl text-base font-semibold border-2 border-amber-300 bg-white hover:bg-amber-50 text-gray-800"
                  >
                    {loading && selectedMethod === 'stars' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Star className="w-5 h-5 mr-2 text-amber-500 fill-amber-500" />
                        Оплатить в Stars
                      </>
                    )}
                  </Button>
                )}

                {/* TON - Always show "Оплатить в TON", connect wallet on click if needed */}
                {methods.ton.enabled && isTelegram && (
                  <Button
                    onClick={async () => {
                      try {
                        if (!wallet.connected) {
                          // Set flag to auto-proceed after wallet connects (in-memory)
                          setPendingTonPayment(true)

                          // CRITICAL: Save to localStorage for persistence across page reload
                          // This handles the TMA redirect flow where user goes to Tonkeeper and back
                          const pendingData = {
                            tierId: selectedTier?.id,
                            personaId: personaId,
                            timestamp: Date.now()
                          }
                          localStorage.setItem(PENDING_TON_STORAGE_KEY, JSON.stringify(pendingData))
                          console.log('[Payment] Saved TON payment intent to localStorage', pendingData)

                          // Open wallet connection modal
                          const modalOpened = await connect()
                          if (!modalOpened) {
                            // Failed to open modal - reset flag and clean storage
                            setPendingTonPayment(false)
                            localStorage.removeItem(PENDING_TON_STORAGE_KEY)
                            setErrorMessage("Не удалось открыть кошелёк")
                            setStep("ERROR")
                          }
                          // Note: handleTonPayment will be called by useEffect when wallet.connected becomes true
                        } else {
                          // Wallet connected - proceed to payment
                          await handleTonPayment()
                        }
                      } catch (error) {
                        console.error('[Payment] TON button error:', error)
                        setPendingTonPayment(false)
                        localStorage.removeItem(PENDING_TON_STORAGE_KEY)
                        setErrorMessage(getErrorMessage(error, "Ошибка подключения кошелька"))
                        setStep("ERROR")
                      }
                    }}
                    disabled={loading || isLoadingData || wallet.loading || pendingTonPayment}
                    variant={wallet.connected ? "default" : "outline"}
                    className={`w-full h-14 rounded-xl text-base font-semibold ${
                      wallet.connected
                        ? 'bg-[#0098EA] hover:bg-[#0088D4] text-white'
                        : 'border-2 border-[#0098EA] bg-white hover:bg-[#0098EA]/5 text-[#0098EA]'
                    }`}
                  >
                    {loading && selectedMethod === 'ton' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : wallet.loading || pendingTonPayment ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Подключение...
                      </>
                    ) : (
                      <>
                        <Coins className="w-5 h-5 mr-2" />
                        Оплатить в TON
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          {step === "PROCESSING" && (
            <div className="flex flex-col items-center py-12">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
              <p className="text-lg font-medium">Создание платежа...</p>
              <p className="text-muted-foreground text-sm mt-1">Подождите немного</p>
            </div>
          )}

          {step === "REDIRECT" && (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="animate-spin w-12 h-12 text-primary mb-4" />
              <p className="text-lg font-medium">Переход к оплате...</p>
              <p className="text-muted-foreground text-sm mt-1">Вы будете перенаправлены</p>
            </div>
          )}

          {step === "SUCCESS" && (
            <div className="flex flex-col items-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-lg font-medium">Оплата успешна!</p>
              <p className="text-muted-foreground text-sm mt-1">Начинаем генерацию...</p>
            </div>
          )}

          {step === "ERROR" && (
            <div className="flex flex-col items-center py-12">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-lg font-medium">Ошибка оплаты</p>
              <p className="text-muted-foreground text-sm mt-1 text-center px-4">{errorMessage}</p>
              <Button onClick={() => setStep("FORM")} variant="default" className="mt-4">
                Попробовать снова
              </Button>
            </div>
          )}

          {step === "STARS_WAITING" && (
            <div className="flex flex-col items-center py-12">
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <Star className="w-10 h-10 text-blue-500" />
              </div>
              <p className="text-lg font-medium">Откройте Telegram</p>
              <p className="text-muted-foreground text-sm mt-1 text-center">
                Счёт отправлен в Telegram.<br />
                Оплатите его и вернитесь сюда.
              </p>
              <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Ожидание оплаты...</span>
              </div>
              <Button onClick={() => setStep("FORM")} variant="ghost" className="mt-4 text-sm">
                Отмена
              </Button>
            </div>
          )}

          {step === "TON_PAYMENT" && tonPaymentData && (
            <div className="flex flex-col items-center py-6">
              <div className="w-16 h-16 rounded-full bg-[#0098EA]/10 flex items-center justify-center mb-4">
                <Coins className="w-8 h-8 text-[#0098EA]" />
              </div>
              <p className="text-lg font-medium mb-2">Оплата через TON</p>

              {/* Amount */}
              <div className="text-3xl font-bold text-[#0098EA] mb-4">
                {tonPaymentData.amount} TON
              </div>

              {/* Wallet info */}
              <p className="text-sm text-muted-foreground mb-4">
                С кошелька {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
              </p>

              {/* Single payment button */}
              <Button
                onClick={handleTonConnectSend}
                disabled={loading}
                className="w-full h-14 rounded-xl text-base font-semibold bg-[#0098EA] hover:bg-[#0088D4] text-white"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Coins className="w-5 h-5 mr-2" />
                    Оплатить {tonPaymentData.amount} TON
                  </>
                )}
              </Button>

              <Button onClick={() => setStep("FORM")} variant="ghost" className="mt-4 text-sm">
                Отмена
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
