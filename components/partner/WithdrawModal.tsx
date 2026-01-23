'use client'

import { useState } from 'react'
import { X, Loader2, CreditCard, Smartphone } from 'lucide-react'
import { MIN_WITHDRAWAL, NDFL_RATE } from '@/lib/partner-types'

interface WithdrawModalProps {
  isOpen: boolean
  onClose: () => void
  availableBalance: number
  onSubmit: (data: {
    payoutMethod: 'card' | 'sbp'
    cardNumber?: string
    phone?: string
    recipientName: string
  }) => Promise<boolean>
  loading: boolean
  error: string | null
}

export function WithdrawModal({
  isOpen,
  onClose,
  availableBalance,
  onSubmit,
  loading,
  error
}: WithdrawModalProps) {
  const [method, setMethod] = useState<'card' | 'sbp'>('sbp')
  const [cardNumber, setCardNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [recipientName, setRecipientName] = useState('')

  const canWithdraw = availableBalance >= MIN_WITHDRAWAL

  const ndflAmount = Math.round(availableBalance * NDFL_RATE * 100) / 100
  const payoutAmount = Math.round(availableBalance * (1 - NDFL_RATE) * 100) / 100

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16)
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
  }

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length === 0) return ''
    if (digits.length <= 1) return `+${digits}`
    if (digits.length <= 4) return `+${digits.slice(0, 1)} (${digits.slice(1)}`
    if (digits.length <= 7) return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4)}`
    if (digits.length <= 9) return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
    return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const success = await onSubmit({
      payoutMethod: method,
      cardNumber: method === 'card' ? cardNumber.replace(/\s/g, '') : undefined,
      phone: method === 'sbp' ? phone.replace(/\D/g, '') : undefined,
      recipientName: recipientName.trim()
    })

    if (success) {
      setCardNumber('')
      setPhone('')
      setRecipientName('')
      onClose()
    }
  }

  const isFormValid = () => {
    if (!recipientName.trim()) return false
    if (method === 'card' && cardNumber.replace(/\s/g, '').length !== 16) return false
    if (method === 'sbp' && phone.replace(/\D/g, '').length !== 11) return false
    return canWithdraw
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-background border rounded-xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Withdraw Funds</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Available Balance */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Available Balance</div>
            <div className="text-2xl font-bold">
              {availableBalance.toLocaleString('ru-RU')} RUB
            </div>
            {!canWithdraw && (
              <div className="text-xs text-red-500 mt-1">
                Minimum withdrawal: {MIN_WITHDRAWAL.toLocaleString('ru-RU')} RUB
              </div>
            )}
          </div>

          {/* Method Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Payout Method</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod('sbp')}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                  method === 'sbp'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Smartphone className="w-5 h-5" />
                <div className="text-left">
                  <div className="text-sm font-medium">SBP</div>
                  <div className="text-xs text-muted-foreground">By phone</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMethod('card')}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                  method === 'card'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <div className="text-left">
                  <div className="text-sm font-medium">Card</div>
                  <div className="text-xs text-muted-foreground">Bank card</div>
                </div>
              </button>
            </div>
          </div>

          {/* Card Number */}
          {method === 'card' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Card Number</label>
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="1234 5678 9012 3456"
                className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {/* Phone */}
          {method === 'sbp' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="+7 (999) 123-45-67"
                className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {/* Recipient Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Recipient Name (as in passport)</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Ivan Ivanov"
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Summary */}
          {canWithdraw && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span>{availableBalance.toLocaleString('ru-RU')} RUB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">NDFL (13%)</span>
                <span className="text-red-500">-{ndflAmount.toLocaleString('ru-RU')} RUB</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-medium">
                <span>You will receive</span>
                <span className="text-green-500">{payoutAmount.toLocaleString('ru-RU')} RUB</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 text-red-500 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!isFormValid() || loading}
            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Submit Withdrawal Request'
            )}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            Processing time: 1-3 business days
          </p>
        </form>
      </div>
    </div>
  )
}
