"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { X, Check, Loader2, CreditCard, Smartphone, Mail, ShieldCheck } from "lucide-react"

interface PricingTier {
  id: string
  photos: number
  price: number
  popular?: boolean
}

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  telegramUserId?: number  // Primary identifier for Telegram users
  deviceId: string         // Fallback identifier for web users
  tier: PricingTier
  personaId?: string  // For post-payment redirect to generation
}

type PaymentMethod = "card" | "sbp" | "tpay"

interface PaymentResponse {
  paymentId: string
  confirmationUrl: string
  testMode: boolean
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSuccess, telegramUserId, deviceId, tier, personaId }) => {
  const [step, setStep] = useState<"FORM" | "PROCESSING" | "REDIRECT" | "SUCCESS" | "ERROR">("FORM")
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("card")
  const [errorMessage, setErrorMessage] = useState("")

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("FORM")
      setLoading(false)
      setEmailError("")
      setErrorMessage("")
    }
  }, [isOpen])

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

  const handlePayment = useCallback(async () => {
    if (!validateEmail(email)) return

    // Validate that we have at least one identifier for post-payment restoration
    if (!telegramUserId && !deviceId) {
      console.error("[Payment] Missing identifiers - cannot proceed")
      setErrorMessage("Ошибка идентификации пользователя. Перезагрузите страницу.")
      setStep("ERROR")
      return
    }

    setLoading(true)
    setStep("PROCESSING")
    setErrorMessage("")

    try {
      // Get pending referral code from localStorage
      const pendingReferral = typeof window !== "undefined"
        ? localStorage.getItem("pinglass_pending_referral")
        : null

      const response = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId,  // Primary identifier for Telegram users
          deviceId,        // Fallback for web users
          email: email.trim(),
          paymentMethod: selectedMethod,
          tierId: tier.id,
          photoCount: tier.photos,
          referralCode: pendingReferral || undefined,
        }),
      })

      // Mark referral as applied
      if (pendingReferral) {
        localStorage.setItem("pinglass_referral_applied", "true")
        localStorage.removeItem("pinglass_pending_referral")
      }

      const data: PaymentResponse = await response.json()

      if (!response.ok) {
        throw new Error((data as unknown as { error: string }).error || "Ошибка создания платежа")
      }

      // Always redirect to T-Bank payment page (works for both test and production)
      // In test mode, user enters test card data manually on T-Bank form:
      // Success: 4111 1111 1111 1111, Fail: 5555 5555 5555 5599
      if (data.confirmationUrl) {
        // Save pending payment state for post-payment restoration
        const pendingPayment = {
          personaId,
          telegramUserId,  // Primary identifier for cross-device sync
          deviceId,        // Fallback identification
          tierId: tier.id,
          tierPhotos: tier.photos,
          tierPrice: tier.price,
          timestamp: Date.now(),
        }
        localStorage.setItem("pinglass_pending_payment", JSON.stringify(pendingPayment))

        setStep("REDIRECT")
        window.location.href = data.confirmationUrl
      } else {
        throw new Error("Не получен URL для оплаты")
      }
    } catch (error) {
      console.error("Payment error:", error)
      setErrorMessage(error instanceof Error ? error.message : "Произошла ошибка")
      setStep("ERROR")
    } finally {
      setLoading(false)
    }
  }, [email, selectedMethod, telegramUserId, deviceId, tier, personaId, onSuccess, onClose])

  if (!isOpen) return null

  const paymentMethods = [
    {
      id: "card" as PaymentMethod,
      name: "Банковская карта",
      description: "Visa, Mastercard, МИР",
      icon: CreditCard,
    },
    {
      id: "sbp" as PaymentMethod,
      name: "СБП",
      description: "Система быстрых платежей",
      icon: Smartphone,
    },
    {
      id: "tpay" as PaymentMethod,
      name: "T-Pay",
      description: "Оплата через Т-Банк",
      icon: () => (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm0-8h-2V7h2v2zm4 8h-2v-4h2v4zm0-6h-2V9h2v2z"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-background w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold">Безопасная оплата</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "FORM" && (
            <div className="space-y-6">
              {/* Price */}
              <div className="text-center pb-4 border-b border-border">
                <div className="text-4xl font-bold text-primary">{tier.price} ₽</div>
                <p className="text-muted-foreground text-sm mt-1">
                  PinGlass Pro — {tier.photos} AI-фотографий
                </p>
              </div>

              {/* Payment Methods */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  Способ оплаты
                </label>
                <div className="grid gap-2">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setSelectedMethod(method.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                          selectedMethod === method.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${
                          selectedMethod === method.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{method.name}</div>
                          <div className="text-xs text-muted-foreground">{method.description}</div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedMethod === method.id
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/30"
                        }`}>
                          {selectedMethod === method.id && (
                            <Check className="w-3 h-3 text-primary-foreground" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Email Input */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email для чека
                </label>
                <input
                  id="email"
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
                  <p className="text-red-500 text-xs mt-1">{emailError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  На этот адрес придёт электронный чек
                </p>
              </div>

              {/* Pay Button */}
              <button
                onClick={handlePayment}
                disabled={loading || !email.trim()}
                className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Обработка...
                  </>
                ) : (
                  <>
                    Оплатить {tier.price} ₽
                  </>
                )}
              </button>

              {/* Security Note */}
              <p className="text-xs text-center text-muted-foreground">
                Платёж защищён шифрованием T-Bank
              </p>
            </div>
          )}

          {step === "PROCESSING" && (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="animate-spin w-12 h-12 text-primary mb-4" />
              <p className="text-lg font-medium">Создание платежа...</p>
              <p className="text-muted-foreground text-sm mt-1">Подождите немного</p>
            </div>
          )}

          {step === "REDIRECT" && (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="animate-spin w-12 h-12 text-primary mb-4" />
              <p className="text-lg font-medium">Переход к оплате...</p>
              <p className="text-muted-foreground text-sm mt-1">Вы будете перенаправлены на страницу банка</p>
            </div>
          )}

          {step === "SUCCESS" && (
            <div className="flex flex-col items-center py-12">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-lg font-medium">Оплата успешна!</p>
              <p className="text-muted-foreground text-sm mt-1">Чек отправлен на {email}</p>
            </div>
          )}

          {step === "ERROR" && (
            <div className="flex flex-col items-center py-12">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-lg font-medium">Ошибка оплаты</p>
              <p className="text-muted-foreground text-sm mt-1 text-center">{errorMessage}</p>
              <button
                onClick={() => setStep("FORM")}
                className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                Попробовать снова
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
