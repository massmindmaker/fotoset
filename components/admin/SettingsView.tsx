'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'

interface PricingTier {
  name: string
  price: number
  photoCount: number
  isActive: boolean
  isPopular?: boolean
}

interface PricingTiers {
  starter: PricingTier
  standard: PricingTier
  premium: PricingTier
}

const DEFAULT_PRICING: PricingTiers = {
  starter: { name: 'Starter', price: 499, photoCount: 7, isActive: true },
  standard: { name: 'Standard', price: 999, photoCount: 15, isActive: true, isPopular: true },
  premium: { name: 'Premium', price: 1499, photoCount: 23, isActive: true }
}

export function SettingsView() {
  const [pricing, setPricing] = useState<PricingTiers>(DEFAULT_PRICING)
  const [originalPricing, setOriginalPricing] = useState<PricingTiers>(DEFAULT_PRICING)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  const fetchPricing = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/settings/pricing')
      if (!response.ok) {
        throw new Error('Failed to fetch pricing')
      }

      const data = await response.json()
      setPricing(data.pricing)
      setOriginalPricing(data.pricing)
      setHasChanges(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPricing()
  }, [])

  useEffect(() => {
    const changed = JSON.stringify(pricing) !== JSON.stringify(originalPricing)
    setHasChanges(changed)
  }, [pricing, originalPricing])

  const updateTier = (tierId: keyof PricingTiers, field: keyof PricingTier, value: unknown) => {
    setPricing(prev => ({
      ...prev,
      [tierId]: {
        ...prev[tierId],
        [field]: value
      }
    }))
    setSuccess(null)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/admin/settings/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricing })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      setOriginalPricing(pricing)
      setHasChanges(false)
      setSuccess('Тарифы успешно сохранены!')

      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setPricing(originalPricing)
    setSuccess(null)
    setError(null)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 rounded w-48 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 h-64 animate-pulse border border-slate-200"></div>
          ))}
        </div>
      </div>
    )
  }

  const tierOrder: (keyof PricingTiers)[] = ['starter', 'standard', 'premium']
  const tierColors = {
    starter: 'blue',
    standard: 'purple',
    premium: 'pink'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Настройки</h2>
          <p className="text-sm text-slate-500">Управление тарифами и параметрами</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchPricing}
            disabled={loading || saving}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {hasChanges && (
            <button
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 transition-colors disabled:opacity-50"
            >
              Отменить
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-pink-500/25"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Сохранить
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
          <p className="text-emerald-600 text-sm">{success}</p>
        </div>
      )}

      {/* Pricing Section */}
      <section>
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Тарифы</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tierOrder.map(tierId => {
            const tier = pricing[tierId]
            const color = tierColors[tierId]

            return (
              <div
                key={tierId}
                className={`bg-white rounded-xl border-2 ${
                  tier.isPopular ? 'border-purple-400 shadow-lg shadow-purple-100' : 'border-slate-200'
                } overflow-hidden`}
              >
                {/* Header */}
                <div className={`px-6 py-4 ${
                  color === 'blue' ? 'bg-blue-50' :
                  color === 'purple' ? 'bg-purple-50' : 'bg-pink-50'
                } border-b border-slate-200`}>
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={tier.name}
                      onChange={e => updateTier(tierId, 'name', e.target.value)}
                      className="bg-transparent text-lg font-semibold text-slate-800 border-none focus:outline-none focus:ring-2 focus:ring-pink-500 rounded px-2 py-1 -mx-2"
                    />
                    {tier.isPopular && (
                      <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full font-medium">
                        Популярный
                      </span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                  {/* Price */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Цена (₽)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        value={tier.price}
                        onChange={e => updateTier(tierId, 'price', parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-slate-800 text-xl font-bold focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 focus:bg-white"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">₽</span>
                    </div>
                  </div>

                  {/* Photo Count */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Количество фото</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={tier.photoCount}
                      onChange={e => updateTier(tierId, 'photoCount', parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-slate-800 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 focus:bg-white"
                    />
                  </div>

                  {/* Toggles */}
                  <div className="space-y-3 pt-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tier.isActive}
                        onChange={e => updateTier(tierId, 'isActive', e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 bg-white text-pink-500 focus:ring-pink-500"
                      />
                      <span className="text-sm text-slate-700">Активный тариф</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tier.isPopular || false}
                        onChange={e => updateTier(tierId, 'isPopular', e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 bg-white text-pink-500 focus:ring-pink-500"
                      />
                      <span className="text-sm text-slate-700">Отметить как популярный</span>
                    </label>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Preview */}
      <section className="mt-8">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Предпросмотр</h3>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 p-6">
          <div className="flex gap-4 justify-center flex-wrap">
            {tierOrder.map(tierId => {
              const tier = pricing[tierId]
              if (!tier.isActive) return null

              return (
                <div
                  key={tierId}
                  className={`bg-white/10 backdrop-blur rounded-xl p-4 text-center min-w-[140px] ${
                    tier.isPopular ? 'ring-2 ring-purple-400' : ''
                  }`}
                >
                  <p className="text-xs text-slate-300 mb-1">{tier.name}</p>
                  <p className="text-2xl font-bold text-white">{tier.price} ₽</p>
                  <p className="text-sm text-slate-400">{tier.photoCount} фото</p>
                  {tier.isPopular && (
                    <span className="inline-block mt-2 text-xs bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full">
                      Популярный
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
