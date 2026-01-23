'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Save, CreditCard, Smartphone } from 'lucide-react'
import Link from 'next/link'

interface PayoutSettings {
  defaultMethod: 'card' | 'sbp' | null
  cardNumber: string | null
  phone: string | null
  recipientName: string | null
}

export default function PartnerSettingsPage() {
  const [settings, setSettings] = useState<PayoutSettings>({
    defaultMethod: null,
    cardNumber: null,
    phone: null,
    recipientName: null
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form state
  const [method, setMethod] = useState<'card' | 'sbp'>('sbp')
  const [cardNumber, setCardNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [recipientName, setRecipientName] = useState('')

  const fetchSettings = useCallback(async () => {
    const telegramUserId = localStorage.getItem('pinglass_telegram_user_id')
    if (!telegramUserId) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/partner/settings?telegram_user_id=${telegramUserId}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch settings')
      }
      const data = await res.json()

      setSettings(data)

      // Initialize form with existing values
      if (data.defaultMethod) setMethod(data.defaultMethod)
      if (data.cardNumber) setCardNumber(data.cardNumber)
      if (data.phone) setPhone(data.phone)
      if (data.recipientName) setRecipientName(data.recipientName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

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
    setError(null)
    setSuccess(false)

    const telegramUserId = localStorage.getItem('pinglass_telegram_user_id')
    if (!telegramUserId) {
      setError('Not authenticated')
      return
    }

    try {
      setSaving(true)

      const res = await fetch('/api/partner/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUserId: parseInt(telegramUserId),
          defaultMethod: method,
          cardNumber: method === 'card' ? cardNumber.replace(/\s/g, '') : null,
          phone: method === 'sbp' ? phone.replace(/\D/g, '') : null,
          recipientName: recipientName.trim()
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">Payout Settings</h1>
        <p className="text-muted-foreground">
          Configure your default payout method and details
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Method Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Default Payout Method</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMethod('sbp')}
              className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                method === 'sbp'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <Smartphone className="w-6 h-6" />
              <div className="text-left">
                <div className="font-medium">SBP</div>
                <div className="text-xs text-muted-foreground">Fast bank transfer</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMethod('card')}
              className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                method === 'card'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <CreditCard className="w-6 h-6" />
              <div className="text-left">
                <div className="font-medium">Card</div>
                <div className="text-xs text-muted-foreground">Bank card transfer</div>
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
              className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">
              Your card number is stored securely
            </p>
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
              className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">
              Phone number linked to your bank account
            </p>
          </div>
        )}

        {/* Recipient Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Recipient Name (as in passport)</label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Ivan Ivanov Ivanovich"
            className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">
            Full name must match your bank account
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-500/10 text-red-500 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="p-3 bg-green-500/10 text-green-500 text-sm rounded-lg">
            Settings saved successfully!
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Settings
            </>
          )}
        </button>
      </form>

      <div className="pt-6 border-t">
        <h3 className="font-medium mb-2">Important Information</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>NDFL (13%) is automatically deducted from all payouts</li>
          <li>Minimum withdrawal amount: 5,000 RUB</li>
          <li>Processing time: 1-3 business days</li>
          <li>Make sure your name matches your bank account exactly</li>
        </ul>
      </div>
    </div>
  )
}
