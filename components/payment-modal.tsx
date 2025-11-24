"use client"

import type React from "react"
import { useState } from "react"
import { X, Check, Loader2 } from "lucide-react"

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<"OFFER" | "PROCESSING" | "SUCCESS">("OFFER")
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleBuy = async () => {
    setLoading(true)
    setStep("PROCESSING")
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setStep("SUCCESS")
    setLoading(false)
    setTimeout(() => {
      onSuccess()
      onClose()
      setStep("OFFER")
    }, 1500)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h2 className="text-lg font-semibold">Оплата</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "OFFER" && (
            <div className="text-center space-y-4">
              <div className="text-3xl font-bold">500 ₽</div>
              <p className="text-muted-foreground text-sm">Разблокировать генерацию фото</p>
              <button
                onClick={handleBuy}
                disabled={loading}
                className="w-full py-3 bg-primary text-primary-foreground font-medium rounded-xl hover:opacity-90 transition-opacity"
              >
                Оплатить
              </button>
              <p className="text-xs text-muted-foreground">Демо-режим</p>
            </div>
          )}

          {step === "PROCESSING" && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="animate-spin w-10 h-10 text-primary mb-4" />
              <p className="text-muted-foreground">Обработка...</p>
            </div>
          )}

          {step === "SUCCESS" && (
            <div className="flex flex-col items-center py-8">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-7 h-7 text-green-600" />
              </div>
              <p className="font-medium">Готово!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
