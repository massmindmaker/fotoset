'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, AlertCircle, CheckCircle, RefreshCw, CreditCard, ToggleLeft, ToggleRight, Eye, EyeOff, Shield, TestTube, Star, Coins, Copy, Info, Wallet, Palette } from 'lucide-react'
import { PaymentMethodsSettings, DEFAULT_PAYMENT_METHODS } from '@/lib/admin/types'

interface PricingTier {
  name: string
  price: number
  photoCount: number
  isActive: boolean
  isPopular?: boolean
  discount?: number
}

interface PricingTiers {
  starter: PricingTier
  standard: PricingTier
  premium: PricingTier
}

const DEFAULT_PRICING: PricingTiers = {
  starter: { name: 'Starter', price: 499, photoCount: 7, isActive: true, discount: 0 },
  standard: { name: 'Standard', price: 999, photoCount: 15, isActive: true, isPopular: true, discount: 0 },
  premium: { name: 'Premium', price: 1499, photoCount: 23, isActive: true, discount: 0 }
}

interface TBankSettings {
  mode: 'test' | 'production'
  testTerminalKey: string
  testPassword: string
  prodTerminalKey: string
  prodPassword: string
}

const DEFAULT_TBANK: TBankSettings = {
  mode: 'test',
  testTerminalKey: '',
  testPassword: '',
  prodTerminalKey: '',
  prodPassword: ''
}

export function SettingsView() {
  const [pricing, setPricing] = useState<PricingTiers>(DEFAULT_PRICING)
  const [originalPricing, setOriginalPricing] = useState<PricingTiers>(DEFAULT_PRICING)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // T-Bank settings
  const [tbank, setTbank] = useState<TBankSettings>(DEFAULT_TBANK)
  const [originalTbank, setOriginalTbank] = useState<TBankSettings>(DEFAULT_TBANK)
  const [tbankLoading, setTbankLoading] = useState(true)
  const [tbankSaving, setTbankSaving] = useState(false)
  const [tbankError, setTbankError] = useState<string | null>(null)
  const [tbankSuccess, setTbankSuccess] = useState<string | null>(null)
  const [tbankHasChanges, setTbankHasChanges] = useState(false)
  const [showPasswords, setShowPasswords] = useState(false)

  // Payment Methods settings
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodsSettings>(DEFAULT_PAYMENT_METHODS)
  const [originalPaymentMethods, setOriginalPaymentMethods] = useState<PaymentMethodsSettings>(DEFAULT_PAYMENT_METHODS)
  const [pmLoading, setPmLoading] = useState(true)
  const [pmSaving, setPmSaving] = useState(false)
  const [pmError, setPmError] = useState<string | null>(null)
  const [pmSuccess, setPmSuccess] = useState<string | null>(null)
  const [pmHasChanges, setPmHasChanges] = useState(false)

  // WebApp Features settings
  const [stylesEnabled, setStylesEnabled] = useState(false)
  const [originalStylesEnabled, setOriginalStylesEnabled] = useState(false)
  const [featuresLoading, setFeaturesLoading] = useState(true)
  const [featuresSaving, setFeaturesSaving] = useState(false)
  const [featuresError, setFeaturesError] = useState<string | null>(null)
  const [featuresSuccess, setFeaturesSuccess] = useState<string | null>(null)
  const [featuresHasChanges, setFeaturesHasChanges] = useState(false)

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

  const fetchTbank = async () => {
    try {
      setTbankLoading(true)
      setTbankError(null)

      const response = await fetch('/api/admin/settings/tbank')
      if (!response.ok) {
        throw new Error('Failed to fetch T-Bank settings')
      }

      const data = await response.json()
      setTbank(data.settings || DEFAULT_TBANK)
      setOriginalTbank(data.settings || DEFAULT_TBANK)
      setTbankHasChanges(false)
    } catch (err) {
      setTbankError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setTbankLoading(false)
    }
  }

  const fetchPaymentMethods = async () => {
    try {
      setPmLoading(true)
      setPmError(null)

      const response = await fetch('/api/admin/settings/payment-methods')
      if (!response.ok) {
        throw new Error('Failed to fetch payment methods')
      }

      const data = await response.json()
      setPaymentMethods(data.settings || DEFAULT_PAYMENT_METHODS)
      setOriginalPaymentMethods(data.settings || DEFAULT_PAYMENT_METHODS)
      setPmHasChanges(false)
    } catch (err) {
      setPmError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setPmLoading(false)
    }
  }

  const fetchFeatures = async () => {
    try {
      setFeaturesLoading(true)
      setFeaturesError(null)

      const response = await fetch('/api/admin/settings')
      if (!response.ok) {
        throw new Error('Failed to fetch features')
      }

      const data = await response.json()
      const enabled = data.settings?.styles_enabled === true || data.settings?.styles_enabled === 'true'
      setStylesEnabled(enabled)
      setOriginalStylesEnabled(enabled)
      setFeaturesHasChanges(false)
    } catch (err) {
      setFeaturesError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setFeaturesLoading(false)
    }
  }

  useEffect(() => {
    fetchPricing()
    fetchTbank()
    fetchPaymentMethods()
    fetchFeatures()
  }, [])

  useEffect(() => {
    const changed = JSON.stringify(pricing) !== JSON.stringify(originalPricing)
    setHasChanges(changed)
  }, [pricing, originalPricing])

  useEffect(() => {
    const changed = JSON.stringify(tbank) !== JSON.stringify(originalTbank)
    setTbankHasChanges(changed)
  }, [tbank, originalTbank])

  useEffect(() => {
    const changed = JSON.stringify(paymentMethods) !== JSON.stringify(originalPaymentMethods)
    setPmHasChanges(changed)
  }, [paymentMethods, originalPaymentMethods])

  useEffect(() => {
    setFeaturesHasChanges(stylesEnabled !== originalStylesEnabled)
  }, [stylesEnabled, originalStylesEnabled])

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

  const handleTbankSave = async () => {
    try {
      setTbankSaving(true)
      setTbankError(null)
      setTbankSuccess(null)

      const response = await fetch('/api/admin/settings/tbank', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: tbank })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      setOriginalTbank(tbank)
      setTbankHasChanges(false)
      setTbankSuccess('Настройки T-Bank сохранены!')

      setTimeout(() => setTbankSuccess(null), 3000)
    } catch (err) {
      setTbankError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setTbankSaving(false)
    }
  }

  const handleTbankReset = () => {
    setTbank(originalTbank)
    setTbankSuccess(null)
    setTbankError(null)
  }

  const updateTbankField = (field: keyof TBankSettings, value: string) => {
    setTbank(prev => ({ ...prev, [field]: value }))
    setTbankSuccess(null)
  }

  // Payment Methods handlers
  const handlePmSave = async () => {
    try {
      setPmSaving(true)
      setPmError(null)
      setPmSuccess(null)

      const response = await fetch('/api/admin/settings/payment-methods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: paymentMethods })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      setOriginalPaymentMethods(paymentMethods)
      setPmHasChanges(false)
      setPmSuccess('Способы оплаты сохранены!')

      setTimeout(() => setPmSuccess(null), 3000)
    } catch (err) {
      setPmError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setPmSaving(false)
    }
  }

  const handlePmReset = () => {
    setPaymentMethods(originalPaymentMethods)
    setPmSuccess(null)
    setPmError(null)
  }

  // Features handlers
  const handleFeaturesSave = async () => {
    try {
      setFeaturesSaving(true)
      setFeaturesError(null)
      setFeaturesSuccess(null)

      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          settings: { 
            styles_enabled: stylesEnabled 
          } 
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      setOriginalStylesEnabled(stylesEnabled)
      setFeaturesHasChanges(false)
      setFeaturesSuccess('Настройки функций сохранены!')

      setTimeout(() => setFeaturesSuccess(null), 3000)
    } catch (err) {
      setFeaturesError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setFeaturesSaving(false)
    }
  }

  const handleFeaturesReset = () => {
    setStylesEnabled(originalStylesEnabled)
    setFeaturesSuccess(null)
    setFeaturesError(null)
  }

  const updatePaymentMethod = <K extends keyof PaymentMethodsSettings>(
    methodId: K,
    updates: Partial<PaymentMethodsSettings[K]>
  ) => {
    setPaymentMethods(prev => ({
      ...prev,
      [methodId]: {
        ...prev[methodId],
        ...updates
      }
    }))
    setPmSuccess(null)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const maskValue = (value: string) => {
    if (!value) return ''
    if (value.length <= 4) return '••••'
    return '••••••••' + value.slice(-4)
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

      {/* WebApp Features Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg">
              <ToggleRight className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Функции WebApp</h3>
              <p className="text-sm text-slate-500">Управление разделами приложения</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {featuresHasChanges && (
              <button
                onClick={handleFeaturesReset}
                disabled={featuresSaving}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 transition-colors disabled:opacity-50"
              >
                Отменить
              </button>
            )}
            <button
              onClick={handleFeaturesSave}
              disabled={!featuresHasChanges || featuresSaving}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25"
            >
              {featuresSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Сохранить
            </button>
          </div>
        </div>

        {/* Features Alerts */}
        {featuresError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-600 text-sm">{featuresError}</p>
          </div>
        )}

        {featuresSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 mb-4">
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <p className="text-emerald-600 text-sm">{featuresSuccess}</p>
          </div>
        )}

        {featuresLoading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto" />
            <p className="text-slate-500 mt-2">Загрузка настроек...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Palette className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Раздел Стили</h4>
                    <p className="text-sm text-slate-500">Выбор стилей генерации в WebApp</p>
                  </div>
                </div>
                <button
                  onClick={() => setStylesEnabled(!stylesEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    stylesEnabled ? 'bg-purple-500' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                    stylesEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}/>
                </button>
              </div>
              
              {/* Status indicator */}
              <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                stylesEnabled
                  ? 'bg-purple-50 border border-purple-200'
                  : 'bg-slate-50 border border-slate-200'
              }`}>
                {stylesEnabled ? (
                  <>
                    <ToggleRight className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-purple-800">
                      Раздел <strong>Стили</strong> доступен пользователям
                    </span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-600">
                      Раздел <strong>Стили</strong> скрыт, показывается бейдж &quot;Скоро&quot;
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

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

                  {/* Discount */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Скидка (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={tier.discount || 0}
                        onChange={e => updateTier(tierId, 'discount', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-slate-800 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 focus:bg-white"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                    </div>
                    {/* Discounted Price Preview */}
                    {(tier.discount || 0) > 0 && (
                      <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <p className="text-sm text-emerald-700">
                          <span className="font-medium">Итого: </span>
                          <span className="font-bold text-emerald-800">
                            {Math.round(tier.price * (1 - (tier.discount || 0) / 100))} ₽
                          </span>
                          <span className="ml-2 text-slate-400 line-through text-xs">
                            {tier.price} ₽
                          </span>
                        </p>
                      </div>
                    )}
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
        <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl border border-slate-300 p-6">
          <div className="flex gap-4 justify-center flex-wrap">
            {tierOrder.map(tierId => {
              const tier = pricing[tierId]
              if (!tier.isActive) return null

              const discountedPrice = (tier.discount || 0) > 0
                ? Math.round(tier.price * (1 - (tier.discount || 0) / 100))
                : tier.price

              return (
                <div
                  key={tierId}
                  className={`bg-white shadow-md rounded-xl p-4 text-center min-w-[140px] ${
                    tier.isPopular ? 'ring-2 ring-purple-500' : ''
                  }`}
                >
                  <p className="text-xs text-slate-500 mb-1">{tier.name}</p>
                  {(tier.discount || 0) > 0 ? (
                    <div>
                      <p className="text-2xl font-bold text-emerald-600">{discountedPrice} ₽</p>
                      <p className="text-sm text-slate-400 line-through">{tier.price} ₽</p>
                      <span className="inline-block mt-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                        -{tier.discount}%
                      </span>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-slate-900">{tier.price} ₽</p>
                  )}
                  <p className="text-sm text-slate-600 mt-1">{tier.photoCount} фото</p>
                  {tier.isPopular && (
                    <span className="inline-block mt-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      Популярный
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Payment Methods Section */}
      <section className="mt-8 pt-8 border-t border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg">
              <Wallet className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Способы оплаты</h3>
              <p className="text-sm text-slate-500">Включение и настройка платёжных методов</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pmHasChanges && (
              <button
                onClick={handlePmReset}
                disabled={pmSaving}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 transition-colors disabled:opacity-50"
              >
                Отменить
              </button>
            )}
            <button
              onClick={handlePmSave}
              disabled={!pmHasChanges || pmSaving}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-pink-500/25"
            >
              {pmSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Сохранить
            </button>
          </div>
        </div>

        {/* PM Alerts */}
        {pmError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 mb-6">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-600 text-sm">{pmError}</p>
          </div>
        )}

        {pmSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 mb-6">
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <p className="text-emerald-600 text-sm">{pmSuccess}</p>
          </div>
        )}

        {pmLoading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto" />
            <p className="text-slate-500 mt-2">Загрузка настроек...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Warning if no methods enabled */}
            {!paymentMethods.tbank.enabled && !paymentMethods.stars.enabled && !paymentMethods.ton.enabled && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-amber-700 text-sm">Минимум один способ оплаты должен быть активен</p>
              </div>
            )}

            {/* T-Bank Method Card */}
            <div className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${
              paymentMethods.tbank.enabled ? 'border-emerald-300' : 'border-slate-200'
            }`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <CreditCard className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">T-Bank (Карты РФ)</h4>
                      <p className="text-sm text-slate-500">Visa, Mastercard, МИР</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updatePaymentMethod('tbank', { enabled: !paymentMethods.tbank.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      paymentMethods.tbank.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                      paymentMethods.tbank.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}/>
                  </button>
                </div>

                {paymentMethods.tbank.enabled && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Info className="w-4 h-4" />
                      <span>Настройки терминала в разделе ниже</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Telegram Stars Method Card */}
            <div className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${
              paymentMethods.stars.enabled ? 'border-purple-300' : 'border-slate-200'
            }`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Star className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">Telegram Stars</h4>
                      <p className="text-sm text-slate-500">Оплата звёздами в Telegram</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updatePaymentMethod('stars', { enabled: !paymentMethods.stars.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      paymentMethods.stars.enabled ? 'bg-purple-500' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                      paymentMethods.stars.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}/>
                  </button>
                </div>

                {paymentMethods.stars.enabled && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Цены в Stars</label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Starter</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              value={paymentMethods.stars.pricing.starter}
                              onChange={e => updatePaymentMethod('stars', {
                                pricing: { ...paymentMethods.stars.pricing, starter: parseInt(e.target.value) || 0 }
                              })}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-purple-500"
                            />
                            <Star className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Standard</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              value={paymentMethods.stars.pricing.standard}
                              onChange={e => updatePaymentMethod('stars', {
                                pricing: { ...paymentMethods.stars.pricing, standard: parseInt(e.target.value) || 0 }
                              })}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-purple-500"
                            />
                            <Star className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Premium</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              value={paymentMethods.stars.pricing.premium}
                              onChange={e => updatePaymentMethod('stars', {
                                pricing: { ...paymentMethods.stars.pricing, premium: parseInt(e.target.value) || 0 }
                              })}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-purple-500"
                            />
                            <Star className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg flex items-center gap-2 text-sm text-purple-700">
                      <Info className="w-4 h-4" />
                      <span>1 Star ~ 1.8 RUB (курс Telegram)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* TON Method Card */}
            <div className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${
              paymentMethods.ton.enabled ? 'border-blue-300' : 'border-slate-200'
            }`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Coins className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">TON Crypto</h4>
                      <p className="text-sm text-slate-500">Криптовалюта TON</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updatePaymentMethod('ton', { enabled: !paymentMethods.ton.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      paymentMethods.ton.enabled ? 'bg-blue-500' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                      paymentMethods.ton.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}/>
                  </button>
                </div>

                {paymentMethods.ton.enabled && (
                  <div className="mt-4 space-y-4">
                    {/* Wallet Address */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Адрес кошелька</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={paymentMethods.ton.walletAddress}
                          onChange={e => updatePaymentMethod('ton', { walletAddress: e.target.value })}
                          placeholder="UQ... или EQ..."
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 pr-10 text-slate-800 font-mono text-sm focus:outline-none focus:border-blue-500"
                        />
                        {paymentMethods.ton.walletAddress && (
                          <button
                            onClick={() => copyToClipboard(paymentMethods.ton.walletAddress)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded transition-colors"
                            title="Копировать"
                          >
                            <Copy className="w-4 h-4 text-slate-500" />
                          </button>
                        )}
                      </div>
                      {paymentMethods.ton.enabled && !paymentMethods.ton.walletAddress && (
                        <p className="mt-1 text-xs text-red-500">Укажите адрес кошелька для приёма платежей</p>
                      )}
                    </div>

                    {/* TON Pricing */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Цены в TON</label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Starter</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={paymentMethods.ton.pricing.starter}
                              onChange={e => updatePaymentMethod('ton', {
                                pricing: { ...paymentMethods.ton.pricing, starter: parseFloat(e.target.value) || 0 }
                              })}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-500 font-medium">TON</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Standard</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={paymentMethods.ton.pricing.standard}
                              onChange={e => updatePaymentMethod('ton', {
                                pricing: { ...paymentMethods.ton.pricing, standard: parseFloat(e.target.value) || 0 }
                              })}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-500 font-medium">TON</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Premium</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={paymentMethods.ton.pricing.premium}
                              onChange={e => updatePaymentMethod('ton', {
                                pricing: { ...paymentMethods.ton.pricing, premium: parseFloat(e.target.value) || 0 }
                              })}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-500 font-medium">TON</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50 rounded-lg flex items-center gap-2 text-sm text-blue-700">
                      <Info className="w-4 h-4" />
                      <span>Курс TON обновляется автоматически каждые 5 минут</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* T-Bank Settings Section */}
      <section className="mt-8 pt-8 border-t border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <CreditCard className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Платёжная система T-Bank</h3>
              <p className="text-sm text-slate-500">Настройки терминала и режима работы</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {tbankHasChanges && (
              <button
                onClick={handleTbankReset}
                disabled={tbankSaving}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 transition-colors disabled:opacity-50"
              >
                Отменить
              </button>
            )}
            <button
              onClick={handleTbankSave}
              disabled={!tbankHasChanges || tbankSaving}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/25"
            >
              {tbankSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Сохранить
            </button>
          </div>
        </div>

        {/* T-Bank Alerts */}
        {tbankError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 mb-6">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-600 text-sm">{tbankError}</p>
          </div>
        )}

        {tbankSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 mb-6">
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <p className="text-emerald-600 text-sm">{tbankSuccess}</p>
          </div>
        )}

        {tbankLoading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto" />
            <p className="text-slate-500 mt-2">Загрузка настроек...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Mode Toggle */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-slate-900">Режим работы</h4>
                  <p className="text-sm text-slate-500 mt-1">
                    {tbank.mode === 'test'
                      ? 'Тестовый режим — платежи не списываются'
                      : 'Боевой режим — реальные платежи'
                    }
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateTbankField('mode', 'test')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      tbank.mode === 'test'
                        ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <TestTube className="w-4 h-4" />
                    Test
                  </button>
                  <button
                    onClick={() => updateTbankField('mode', 'production')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      tbank.mode === 'production'
                        ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    Production
                  </button>
                </div>
              </div>

              {/* Current Mode Indicator */}
              <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                tbank.mode === 'test'
                  ? 'bg-amber-50 border border-amber-200'
                  : 'bg-emerald-50 border border-emerald-200'
              }`}>
                {tbank.mode === 'test' ? (
                  <>
                    <TestTube className="w-4 h-4 text-amber-600" />
                    <span className="text-sm text-amber-800">
                      Сейчас активен <strong>тестовый режим</strong>. Используются тестовые ключи.
                    </span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm text-emerald-800">
                      Сейчас активен <strong>боевой режим</strong>. Используются production ключи.
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Credentials */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-slate-900">Ключи доступа</h4>
                <button
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showPasswords ? 'Скрыть' : 'Показать'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Test Credentials */}
                <div className={`p-4 rounded-xl border-2 ${
                  tbank.mode === 'test' ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-slate-50'
                }`}>
                  <div className="flex items-center gap-2 mb-4">
                    <TestTube className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-slate-800">Test</span>
                    {tbank.mode === 'test' && (
                      <span className="ml-auto text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                        Активен
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Terminal Key</label>
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        value={showPasswords ? tbank.testTerminalKey : maskValue(tbank.testTerminalKey)}
                        onChange={(e) => updateTbankField('testTerminalKey', e.target.value)}
                        disabled={!showPasswords}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-100"
                        placeholder="Terminal Key"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        value={showPasswords ? tbank.testPassword : maskValue(tbank.testPassword)}
                        onChange={(e) => updateTbankField('testPassword', e.target.value)}
                        disabled={!showPasswords}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-100"
                        placeholder="Password"
                      />
                    </div>
                  </div>
                </div>

                {/* Production Credentials */}
                <div className={`p-4 rounded-xl border-2 ${
                  tbank.mode === 'production' ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'
                }`}>
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-slate-800">Production</span>
                    {tbank.mode === 'production' && (
                      <span className="ml-auto text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">
                        Активен
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Terminal Key</label>
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        value={showPasswords ? tbank.prodTerminalKey : maskValue(tbank.prodTerminalKey)}
                        onChange={(e) => updateTbankField('prodTerminalKey', e.target.value)}
                        disabled={!showPasswords}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100"
                        placeholder="Terminal Key"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        value={showPasswords ? tbank.prodPassword : maskValue(tbank.prodPassword)}
                        onChange={(e) => updateTbankField('prodPassword', e.target.value)}
                        disabled={!showPasswords}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100"
                        placeholder="Password"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="mt-4 p-3 bg-slate-100 rounded-lg">
                <p className="text-xs text-slate-600">
                  ⚠️ Ключи хранятся в зашифрованном виде в базе данных. При переключении режима
                  автоматически используются соответствующие ключи.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
