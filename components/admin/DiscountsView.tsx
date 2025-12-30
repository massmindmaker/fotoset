'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  RefreshCw,
  Loader2,
  Trash2,
  Edit3,
  X,
  Save,
  Percent,
  DollarSign,
  Tag,
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Copy,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  BarChart3,
  Gift
} from 'lucide-react'

/**
 * DiscountsView Component
 *
 * Promo codes management:
 * - Create/edit/delete promo codes
 * - Percentage and fixed amount discounts
 * - Usage tracking
 * - Date validity
 */

interface PromoCode {
  id: number
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  max_uses: number | null
  current_uses: number
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
  created_by: number
  created_at: string
  admin_email: string | null
}

interface PromoStats {
  totalCodes: number
  activeCodes: number
  expiredCodes: number
  totalUses: number
}

interface CodeUsage {
  id: number
  user_id: number
  payment_id: number
  discount_amount: number
  used_at: string
  telegram_user_id: string | null
  telegram_username: string | null
}

export function DiscountsView() {
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [stats, setStats] = useState<PromoStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [showActiveOnly, setShowActiveOnly] = useState(false)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Details modal
  const [selectedCode, setSelectedCode] = useState<PromoCode | null>(null)
  const [codeUsages, setCodeUsages] = useState<CodeUsage[]>([])
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 0,
    max_uses: '',
    valid_from: '',
    valid_until: '',
    is_active: true
  })

  const fetchCodes = useCallback(async (page = 1) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (showActiveOnly) params.set('active', 'true')

      const response = await fetch(`/api/admin/discounts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch promo codes')
      const data = await response.json()
      setCodes(data.codes || [])
      setStats(data.stats || null)
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setIsLoading(false)
    }
  }, [showActiveOnly])

  useEffect(() => {
    fetchCodes()
  }, [fetchCodes])

  const fetchCodeDetails = async (codeId: number) => {
    setIsLoadingDetails(true)
    try {
      const response = await fetch(`/api/admin/discounts/${codeId}`)
      if (!response.ok) throw new Error('Failed to fetch details')
      const data = await response.json()
      setSelectedCode(data.code)
      setCodeUsages(data.usages || [])
      setIsDetailsOpen(true)
    } catch {
      alert('Ошибка загрузки деталей')
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const openCreateModal = () => {
    setEditingCode(null)
    setFormData({
      code: generatePromoCode(),
      discount_type: 'percentage',
      discount_value: 10,
      max_uses: '',
      valid_from: '',
      valid_until: '',
      is_active: true
    })
    setIsModalOpen(true)
  }

  const openEditModal = (code: PromoCode) => {
    setEditingCode(code)
    setFormData({
      code: code.code,
      discount_type: code.discount_type,
      discount_value: code.discount_value,
      max_uses: code.max_uses?.toString() || '',
      valid_from: code.valid_from ? code.valid_from.split('T')[0] : '',
      valid_until: code.valid_until ? code.valid_until.split('T')[0] : '',
      is_active: code.is_active
    })
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.code || formData.discount_value <= 0) {
      alert('Код и значение скидки обязательны')
      return
    }

    if (formData.discount_type === 'percentage' && formData.discount_value > 100) {
      alert('Процент скидки не может превышать 100')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        code: formData.code,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        valid_from: formData.valid_from || null,
        valid_until: formData.valid_until || null,
        is_active: formData.is_active
      }

      const url = editingCode
        ? `/api/admin/discounts/${editingCode.id}`
        : '/api/admin/discounts'

      const response = await fetch(url, {
        method: editingCode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      setIsModalOpen(false)
      fetchCodes(pagination.page)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить этот промокод?')) return

    try {
      const response = await fetch(`/api/admin/discounts/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')
      fetchCodes(pagination.page)
    } catch {
      alert('Ошибка удаления')
    }
  }

  const toggleActive = async (code: PromoCode) => {
    try {
      await fetch(`/api/admin/discounts/${code.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !code.is_active })
      })
      fetchCodes(pagination.page)
    } catch {
      // Silent fail
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('ru-RU')
  }

  const getStatusBadge = (code: PromoCode) => {
    const now = new Date()

    if (!code.is_active) {
      return (
        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
          Неактивен
        </span>
      )
    }

    if (code.valid_until && new Date(code.valid_until) < now) {
      return (
        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
          Истёк
        </span>
      )
    }

    if (code.valid_from && new Date(code.valid_from) > now) {
      return (
        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
          Запланирован
        </span>
      )
    }

    if (code.max_uses !== null && code.current_uses >= code.max_uses) {
      return (
        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
          Исчерпан
        </span>
      )
    }

    return (
      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
        Активен
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Tag className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.totalCodes}</p>
                <p className="text-xs text-slate-500">Всего кодов</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.activeCodes}</p>
                <p className="text-xs text-slate-500">Активных</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Clock className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.expiredCodes}</p>
                <p className="text-xs text-slate-500">Истекших</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.totalUses}</p>
                <p className="text-xs text-slate-500">Использований</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">
          Промокоды
        </h3>
        <div className="flex items-center gap-3">
          {/* Active Only Toggle */}
          <button
            onClick={() => setShowActiveOnly(!showActiveOnly)}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors
              ${showActiveOnly
                ? 'bg-blue-100 text-blue-700'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }
            `}
          >
            {showActiveOnly ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            Только активные
          </button>

          <button
            onClick={() => fetchCodes(pagination.page)}
            disabled={isLoading}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Создать промокод
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : codes.length === 0 ? (
          <div className="text-center py-12">
            <Gift className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Нет промокодов</p>
            <button
              onClick={openCreateModal}
              className="mt-3 text-blue-600 text-sm hover:underline"
            >
              Создать первый промокод
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Код</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Скидка</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Использовано</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Действует</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Статус</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {codes.map((code) => (
                  <tr key={code.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-slate-100 text-slate-900 font-mono text-sm rounded">
                          {code.code}
                        </code>
                        <button
                          onClick={() => copyCode(code.code)}
                          className="p-1 text-slate-400 hover:text-blue-600"
                          title="Копировать"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {code.discount_type === 'percentage' ? (
                          <>
                            <Percent className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-900 font-medium">{code.discount_value}%</span>
                          </>
                        ) : (
                          <>
                            <DollarSign className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-900 font-medium">{code.discount_value}₽</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {code.current_uses}
                      {code.max_uses !== null && (
                        <span className="text-slate-400"> / {code.max_uses}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {code.valid_from || code.valid_until ? (
                        <span>
                          {formatDate(code.valid_from)} — {formatDate(code.valid_until)}
                        </span>
                      ) : (
                        <span className="text-slate-400">Бессрочно</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(code)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => fetchCodeDetails(code.id)}
                          className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          title="Подробнее"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(code)}
                          className={`p-1.5 rounded ${code.is_active ? 'text-emerald-500 hover:text-slate-600' : 'text-slate-400 hover:text-emerald-500'} hover:bg-slate-100`}
                          title={code.is_active ? 'Деактивировать' : 'Активировать'}
                        >
                          {code.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => openEditModal(code)}
                          className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                          title="Редактировать"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(code.id)}
                          className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => fetchCodes(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="p-2 rounded-lg bg-white border border-slate-200 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-600">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchCodes(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="p-2 rounded-lg bg-white border border-slate-200 disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-auto m-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingCode ? 'Редактировать промокод' : 'Новый промокод'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Код *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                    placeholder="PROMO2024"
                  />
                  <button
                    onClick={() => setFormData({ ...formData, code: generatePromoCode() })}
                    type="button"
                    className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Тип скидки *
                  </label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as 'percentage' | 'fixed' })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="percentage">Процент (%)</option>
                    <option value="fixed">Фикс. сумма (₽)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Значение *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                      min="0"
                      max={formData.discount_type === 'percentage' ? 100 : undefined}
                      className="w-full px-3 py-2 pr-8 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {formData.discount_type === 'percentage' ? '%' : '₽'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Макс. использований
                </label>
                <input
                  type="number"
                  value={formData.max_uses}
                  onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                  min="1"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Без ограничений"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Действует с
                  </label>
                  <input
                    type="date"
                    value={formData.valid_from}
                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Действует до
                  </label>
                  <input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="code_is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="code_is_active" className="text-sm text-slate-700">
                  Активен сразу после создания
                </label>
              </div>

              {/* Preview */}
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Предпросмотр:</p>
                <p className="text-sm text-slate-900">
                  Код <code className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-sm">{formData.code || 'XXXXX'}</code>{' '}
                  даёт скидку{' '}
                  <strong>
                    {formData.discount_type === 'percentage'
                      ? `${formData.discount_value}%`
                      : `${formData.discount_value}₽`
                    }
                  </strong>
                  {formData.discount_type === 'percentage' && (
                    <span className="text-slate-500">
                      {' '}(= {Math.round(500 * formData.discount_value / 100)}₽ от 500₽)
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {isDetailsOpen && selectedCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto m-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Промокод: {selectedCode.code}
              </h3>
              <button onClick={() => setIsDetailsOpen(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Code Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Скидка</p>
                  <p className="text-lg font-bold text-slate-900">
                    {selectedCode.discount_type === 'percentage'
                      ? `${selectedCode.discount_value}%`
                      : `${selectedCode.discount_value}₽`
                    }
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Использовано</p>
                  <p className="text-lg font-bold text-slate-900">
                    {selectedCode.current_uses}
                    {selectedCode.max_uses !== null && (
                      <span className="text-slate-400 text-sm font-normal"> / {selectedCode.max_uses}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">Статус</span>
                {getStatusBadge(selectedCode)}
              </div>

              {(selectedCode.valid_from || selectedCode.valid_until) && (
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    {formatDate(selectedCode.valid_from)} — {formatDate(selectedCode.valid_until)}
                  </span>
                </div>
              )}

              {/* Usage History */}
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">
                  История использования ({codeUsages.length})
                </h4>
                {codeUsages.length === 0 ? (
                  <div className="text-center py-4 bg-slate-50 rounded-lg">
                    <Users className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                    <p className="text-sm text-slate-500">Промокод ещё не использовался</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-60 overflow-auto">
                    {codeUsages.map((usage) => (
                      <div key={usage.id} className="p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-900">
                            {usage.telegram_username
                              ? `@${usage.telegram_username}`
                              : `User #${usage.user_id}`
                            }
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(usage.used_at).toLocaleString('ru-RU')}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-emerald-600">
                          -{usage.discount_amount}₽
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end p-4 border-t border-slate-200">
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper to generate random promo code
function generatePromoCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
