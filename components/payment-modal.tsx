"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { X, Check, Loader2, Mail, ShieldCheck } from "lucide-react"
import { extractErrorMessage, getErrorMessage } from "@/lib/error-utils"

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
  telegramUserId?: number  // Telegram-only authentication (optional for non-Telegram context)
  tier: PricingTier
  personaId?: string  // For post-payment redirect to generation
}

interface PaymentResponse {
  paymentId: string
  confirmationUrl: string
  testMode: boolean
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSuccess, telegramUserId, tier, personaId }) => {
  const [step, setStep] = useState<"FORM" | "PROCESSING" | "REDIRECT" | "SUCCESS" | "ERROR">("FORM")
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
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

    // Validate telegramUserId (Telegram-only authentication)
    if (!telegramUserId) {
      console.error("[Payment] Missing telegramUserId")
      setErrorMessage("Требуется авторизация через Telegram")
      setStep("ERROR")
      return
    }

    setLoading(true)
    setStep("PROCESSING")
    setErrorMessage("")

    try {
      // NOTE: Referral code is now stored in DB (user.pending_referral_code)
      // No localStorage needed - API reads referral code directly from DB
      const response = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId,  // Telegram-only authentication
          email: email.trim(),
          tierId: tier.id,
          photoCount: tier.photos,
          // referralCode removed - API uses DB field pending_referral_code
        }),
      })

      const data: PaymentResponse = await response.json()

      if (!response.ok) {
        throw new Error(extractErrorMessage(data, "Ошибка создания платежа"))
      }

      // Always redirect to T-Bank payment page (works for both test and production)
      // In test mode, user enters test card data manually on T-Bank form:
      // Success: 4111 1111 1111 1111, Fail: 5555 5555 5555 5599
      if (data.confirmationUrl) {
        // NOTE: No localStorage needed - telegram_user_id is passed via URL after payment
        // and avatar info is stored in Neon DB
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
  }, [email, telegramUserId, tier])

  if (!isOpen) return null

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

              {/* Email Input - ОБЯЗАТЕЛЬНОЕ ПОЛЕ для фискальных чеков (54-ФЗ) */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email для чека <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={() => validateEmail(email)}
                  placeholder="your@email.com"
                  required
                  aria-required="true"
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
                  Обязательно — на этот адрес придёт электронный чек (54-ФЗ)
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
