'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Plus,
  Loader2,
  Package,
  X,
  Save,
} from 'lucide-react'
import { usePromptsContext, PhotoPack, PackItem } from './PromptsContext'
import { PackCard } from './PackCard'

export function PhotoPacksColumn() {
  const { registerPacksRefresh } = usePromptsContext()

  const [packs, setPacks] = useState<PhotoPack[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })

  // Selected pack for detail view
  const [selectedPackId, setSelectedPackId] = useState<number | null>(null)
  const [expandedPackId, setExpandedPackId] = useState<number | null>(null)
  const [packItemsMap, setPackItemsMap] = useState<Record<number, PackItem[]>>({})
  const [loadingItemsMap, setLoadingItemsMap] = useState<Record<number, boolean>>({})

  // Create/Edit modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPack, setEditingPack] = useState<PhotoPack | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    cover_url: '',
    is_active: true
  })

  // Add item modal
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [itemFormData, setItemFormData] = useState({
    photo_url: '',
    prompt: ''
  })

  const fetchPacks = useCallback(async (page = 1) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/packs?page=${page}&limit=20`)
      if (!response.ok) throw new Error('Failed to fetch packs')
      const data = await response.json()
      setPacks(data.packs || [])
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPacks()
  }, [fetchPacks])

  // Register refresh callback with context
  useEffect(() => {
    registerPacksRefresh(() => fetchPacks(pagination.page))
  }, [registerPacksRefresh, pagination.page, fetchPacks])

  const fetchPackItems = async (packId: number) => {
    setLoadingItemsMap(prev => ({ ...prev, [packId]: true }))
    try {
      const response = await fetch(`/api/admin/packs/${packId}`)
      if (!response.ok) throw new Error('Failed to fetch pack')
      const data = await response.json()
      setPackItemsMap(prev => ({ ...prev, [packId]: data.items || [] }))
    } catch {
      setPackItemsMap(prev => ({ ...prev, [packId]: [] }))
    } finally {
      setLoadingItemsMap(prev => ({ ...prev, [packId]: false }))
    }
  }

  const toggleExpand = (packId: number) => {
    if (expandedPackId === packId) {
      setExpandedPackId(null)
    } else {
      setExpandedPackId(packId)
      // Fetch items if not already loaded
      if (!packItemsMap[packId]) {
        fetchPackItems(packId)
      }
    }
  }

  const selectPack = (pack: PhotoPack) => {
    setSelectedPackId(pack.id)
    // Also expand and fetch items
    if (expandedPackId !== pack.id) {
      setExpandedPackId(pack.id)
      if (!packItemsMap[pack.id]) {
        fetchPackItems(pack.id)
      }
    }
  }

  const openCreateModal = () => {
    setEditingPack(null)
    setFormData({ name: '', description: '', cover_url: '', is_active: true })
    setIsModalOpen(true)
  }

  const openEditModal = (pack: PhotoPack) => {
    setEditingPack(pack)
    setFormData({
      name: pack.name,
      description: pack.description || '',
      cover_url: pack.cover_url || '',
      is_active: pack.is_active
    })
    setIsModalOpen(true)
  }

  const handleSavePack = async () => {
    if (!formData.name) {
      alert('Название обязательно')
      return
    }

    setIsSaving(true)
    try {
      const url = editingPack
        ? `/api/admin/packs/${editingPack.id}`
        : '/api/admin/packs'

      const response = await fetch(url, {
        method: editingPack ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error('Failed to save pack')

      setIsModalOpen(false)
      fetchPacks(pagination.page)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePack = async (id: number) => {
    if (!confirm('Удалить этот фотопак и все его элементы?')) return

    try {
      const response = await fetch(`/api/admin/packs/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')

      if (selectedPackId === id) {
        setSelectedPackId(null)
        setExpandedPackId(null)
      }
      fetchPacks(pagination.page)
    } catch {
      alert('Ошибка удаления')
    }
  }

  const handleAddItem = async () => {
    if (!itemFormData.photo_url || !selectedPackId) {
      alert('URL фото обязателен')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/packs/${selectedPackId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemFormData)
      })

      if (!response.ok) throw new Error('Failed to add item')

      setIsItemModalOpen(false)
      setItemFormData({ photo_url: '', prompt: '' })
      fetchPackItems(selectedPackId)
      fetchPacks(pagination.page)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка добавления')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteItem = async (packId: number, itemId: number) => {
    if (!confirm('Удалить это фото из пака?')) return

    try {
      const response = await fetch(`/api/admin/packs/${packId}/items/${itemId}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete')
      fetchPackItems(packId)
      fetchPacks(pagination.page)
    } catch {
      alert('Ошибка удаления')
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            Фотопаки ({pagination.total})
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchPacks(pagination.page)}
              disabled={isLoading}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              title="Обновить"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openCreateModal}
              className="p-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
              title="Создать пак"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : packs.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Нет фотопаков</p>
            <button
              onClick={openCreateModal}
              className="mt-3 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Создать первый пак
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {packs.map((pack) => (
              <PackCard
                key={pack.id}
                pack={pack}
                items={packItemsMap[pack.id] || []}
                isExpanded={expandedPackId === pack.id}
                isSelected={selectedPackId === pack.id}
                isLoadingItems={loadingItemsMap[pack.id] || false}
                onToggleExpand={() => toggleExpand(pack.id)}
                onSelect={() => selectPack(pack)}
                onEdit={() => openEditModal(pack)}
                onDelete={() => handleDeletePack(pack.id)}
                onDeleteItem={(itemId) => handleDeleteItem(pack.id, itemId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Item Button (when pack is selected) */}
      {selectedPackId && (
        <div className="flex-shrink-0 p-3 border-t border-slate-200">
          <button
            onClick={() => setIsItemModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Добавить в пак
          </button>
        </div>
      )}

      {/* Create/Edit Pack Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-auto m-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingPack ? 'Редактировать пак' : 'Новый фотопак'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Название *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Название пака"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Описание
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Описание фотопака..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  URL обложки
                </label>
                <input
                  type="text"
                  value={formData.cover_url}
                  onChange={(e) => setFormData({ ...formData, cover_url: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pack_is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300"
                />
                <label htmlFor="pack_is_active" className="text-sm text-slate-700">
                  Активен (виден пользователям)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleSavePack}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {isItemModalOpen && selectedPackId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-auto m-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Добавить фото в пак
              </h3>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  URL фото *
                </label>
                <input
                  type="text"
                  value={itemFormData.photo_url}
                  onChange={(e) => setItemFormData({ ...itemFormData, photo_url: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Промпт (опционально)
                </label>
                <textarea
                  value={itemFormData.prompt}
                  onChange={(e) => setItemFormData({ ...itemFormData, prompt: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Промпт для этого фото..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleAddItem}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
