'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  RefreshCw,
  Loader2,
  Star,
  Trash2,
  Edit3,
  Image,
  FileText,
  Package,
  FlaskConical,
  X,
  Save,
  GripVertical,
  Eye,
  Copy,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { PromptTesterView } from './PromptTesterView'

/**
 * PromptsAndPacksView Component
 *
 * Tabbed interface for:
 * - Prompt Tester (existing functionality)
 * - Saved Prompts (CRUD)
 * - PhotoPacks (CRUD with items)
 */

type TabType = 'tester' | 'prompts' | 'packs'

interface SavedPrompt {
  id: number
  admin_id: number
  name: string
  prompt: string
  negative_prompt: string | null
  style_id: string | null
  preview_url: string | null
  is_favorite: boolean
  tags: string[] | null
  created_at: string
  updated_at: string
  admin_email: string | null
}

interface PhotoPack {
  id: number
  admin_id: number
  name: string
  description: string | null
  cover_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  admin_email: string | null
  items_count: number
}

interface PackItem {
  id: number
  pack_id: number
  photo_url: string
  prompt: string | null
  position: number
  created_at: string
  updated_at: string
}

export function PromptsAndPacksView() {
  const [activeTab, setActiveTab] = useState<TabType>('tester')

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'tester', label: 'Тестер', icon: <FlaskConical className="w-4 h-4" /> },
    { id: 'prompts', label: 'Сохранённые промпты', icon: <FileText className="w-4 h-4" /> },
    { id: 'packs', label: 'Фотопаки', icon: <Package className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'tester' && <PromptTesterView />}
      {activeTab === 'prompts' && <SavedPromptsTab />}
      {activeTab === 'packs' && <PhotoPacksTab />}
    </div>
  )
}

// ============================================
// Saved Prompts Tab
// ============================================

function SavedPromptsTab() {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<SavedPrompt | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    prompt: '',
    negative_prompt: '',
    style_id: '',
    preview_url: '',
    is_favorite: false,
    tags: ''
  })

  const fetchPrompts = useCallback(async (page = 1) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/prompts?page=${page}&limit=20`)
      if (!response.ok) throw new Error('Failed to fetch prompts')
      const data = await response.json()
      setPrompts(data.prompts || [])
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  const openCreateModal = () => {
    setEditingPrompt(null)
    setFormData({
      name: '',
      prompt: '',
      negative_prompt: '',
      style_id: '',
      preview_url: '',
      is_favorite: false,
      tags: ''
    })
    setIsModalOpen(true)
  }

  const openEditModal = (prompt: SavedPrompt) => {
    setEditingPrompt(prompt)
    setFormData({
      name: prompt.name,
      prompt: prompt.prompt,
      negative_prompt: prompt.negative_prompt || '',
      style_id: prompt.style_id || '',
      preview_url: prompt.preview_url || '',
      is_favorite: prompt.is_favorite,
      tags: prompt.tags?.join(', ') || ''
    })
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.prompt) {
      alert('Название и промпт обязательны')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        ...formData,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : null
      }

      const url = editingPrompt
        ? `/api/admin/prompts/${editingPrompt.id}`
        : '/api/admin/prompts'

      const response = await fetch(url, {
        method: editingPrompt ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) throw new Error('Failed to save prompt')

      setIsModalOpen(false)
      fetchPrompts(pagination.page)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить этот промпт?')) return

    try {
      const response = await fetch(`/api/admin/prompts/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')
      fetchPrompts(pagination.page)
    } catch (err) {
      alert('Ошибка удаления')
    }
  }

  const toggleFavorite = async (prompt: SavedPrompt) => {
    try {
      await fetch(`/api/admin/prompts/${prompt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: !prompt.is_favorite })
      })
      fetchPrompts(pagination.page)
    } catch {
      // Silent fail
    }
  }

  const copyPrompt = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const [isImporting, setIsImporting] = useState(false)

  const importDreamPack = async () => {
    if (!confirm('Импортировать DREAM PACK (17 промптов)?')) return

    setIsImporting(true)
    try {
      const response = await fetch('/api/admin/packs/dreampack/import', {
        method: 'POST'
      })

      if (!response.ok) throw new Error('Import failed')

      const data = await response.json()
      alert(`Импортировано: ${data.imported}, пропущено: ${data.skipped}`)
      fetchPrompts(1)
    } catch (err) {
      alert('Ошибка импорта: ' + (err instanceof Error ? err.message : 'Unknown'))
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">
          Сохранённые промпты ({pagination.total})
        </h3>
        <div className="flex gap-2">
          <button
            onClick={importDreamPack}
            disabled={isImporting}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
          >
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
            DREAM PACK
          </button>
          <button
            onClick={() => fetchPrompts(pagination.page)}
            disabled={isLoading}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Добавить промпт
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : prompts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Нет сохранённых промптов</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Preview Image */}
              {prompt.preview_url ? (
                <div className="aspect-video bg-slate-100 relative">
                  <img
                    src={prompt.preview_url}
                    alt={prompt.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-slate-100 flex items-center justify-center">
                  <Image className="w-8 h-8 text-slate-300" />
                </div>
              )}

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-medium text-slate-900 line-clamp-1">
                    {prompt.name}
                  </h4>
                  <button
                    onClick={() => toggleFavorite(prompt)}
                    className={`p-1 rounded ${prompt.is_favorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'}`}
                  >
                    <Star className="w-4 h-4" fill={prompt.is_favorite ? 'currentColor' : 'none'} />
                  </button>
                </div>

                <p className="text-sm text-slate-500 line-clamp-2 mb-3">
                  {prompt.prompt}
                </p>

                {/* Tags */}
                {prompt.tags && prompt.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {prompt.tags.slice(0, 3).map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {prompt.tags.length > 3 && (
                      <span className="text-xs text-slate-400">+{prompt.tags.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => copyPrompt(prompt.prompt)}
                    className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                    title="Копировать"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditModal(prompt)}
                    className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    title="Редактировать"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(prompt.id)}
                    className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => fetchPrompts(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="p-2 rounded-lg bg-white border border-slate-200 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-600">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchPrompts(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="p-2 rounded-lg bg-white border border-slate-200 disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto m-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingPrompt ? 'Редактировать промпт' : 'Новый промпт'}
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Название промпта"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Промпт *
                </label>
                <textarea
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Основной промпт для генерации..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Негативный промпт
                </label>
                <textarea
                  value={formData.negative_prompt}
                  onChange={(e) => setFormData({ ...formData, negative_prompt: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Что исключить из генерации..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Стиль
                  </label>
                  <select
                    value={formData.style_id}
                    onChange={(e) => setFormData({ ...formData, style_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Не выбран</option>
                    <option value="professional">Professional</option>
                    <option value="lifestyle">Lifestyle</option>
                    <option value="creative">Creative</option>
                    <option value="dreampack">DREAM PACK</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Теги
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="тег1, тег2, тег3"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  URL превью
                </label>
                <input
                  type="text"
                  value={formData.preview_url}
                  onChange={(e) => setFormData({ ...formData, preview_url: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_favorite"
                  checked={formData.is_favorite}
                  onChange={(e) => setFormData({ ...formData, is_favorite: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="is_favorite" className="text-sm text-slate-700">
                  Добавить в избранное
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
    </div>
  )
}

// ============================================
// PhotoPacks Tab
// ============================================

function PhotoPacksTab() {
  const [packs, setPacks] = useState<PhotoPack[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })

  // Selected pack for detail view
  const [selectedPack, setSelectedPack] = useState<PhotoPack | null>(null)
  const [packItems, setPackItems] = useState<PackItem[]>([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)

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

  const fetchPackItems = async (packId: number) => {
    setIsLoadingItems(true)
    try {
      const response = await fetch(`/api/admin/packs/${packId}`)
      if (!response.ok) throw new Error('Failed to fetch pack')
      const data = await response.json()
      setPackItems(data.items || [])
    } catch {
      setPackItems([])
    } finally {
      setIsLoadingItems(false)
    }
  }

  const selectPack = (pack: PhotoPack) => {
    setSelectedPack(pack)
    fetchPackItems(pack.id)
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

      // Update selected pack if editing
      if (editingPack && selectedPack?.id === editingPack.id) {
        const data = await response.json()
        setSelectedPack(data.pack)
      }
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

      if (selectedPack?.id === id) {
        setSelectedPack(null)
        setPackItems([])
      }
      fetchPacks(pagination.page)
    } catch {
      alert('Ошибка удаления')
    }
  }

  const handleAddItem = async () => {
    if (!itemFormData.photo_url || !selectedPack) {
      alert('URL фото обязателен')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/packs/${selectedPack.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemFormData)
      })

      if (!response.ok) throw new Error('Failed to add item')

      setIsItemModalOpen(false)
      setItemFormData({ photo_url: '', prompt: '' })
      fetchPackItems(selectedPack.id)
      fetchPacks(pagination.page)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка добавления')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteItem = async (itemId: number) => {
    if (!selectedPack) return
    if (!confirm('Удалить это фото из пака?')) return

    try {
      const response = await fetch(`/api/admin/packs/${selectedPack.id}/items/${itemId}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete')
      fetchPackItems(selectedPack.id)
      fetchPacks(pagination.page)
    } catch {
      alert('Ошибка удаления')
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Packs List */}
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Фотопаки ({pagination.total})
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => fetchPacks(pagination.page)}
              disabled={isLoading}
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openCreateModal}
              className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : packs.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-slate-200">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Нет фотопаков</p>
          </div>
        ) : (
          <div className="space-y-2">
            {packs.map((pack) => (
              <div
                key={pack.id}
                onClick={() => selectPack(pack)}
                className={`
                  p-3 rounded-xl border cursor-pointer transition-all
                  ${selectedPack?.id === pack.id
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  {pack.cover_url ? (
                    <img
                      src={pack.cover_url}
                      alt={pack.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Package className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-900 truncate">{pack.name}</h4>
                      {!pack.is_active && (
                        <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-xs rounded">
                          скрыт
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{pack.items_count} фото</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(pack) }}
                      className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-white"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeletePack(pack.id) }}
                      className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-white"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => fetchPacks(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded bg-white border border-slate-200 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-600">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => fetchPacks(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded bg-white border border-slate-200 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Right: Pack Details */}
      <div className="lg:col-span-2">
        {selectedPack ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Pack Header */}
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{selectedPack.name}</h3>
                  {selectedPack.description && (
                    <p className="text-sm text-slate-500 mt-1">{selectedPack.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setIsItemModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Добавить фото
                </button>
              </div>
            </div>

            {/* Pack Items Grid */}
            <div className="p-4">
              {isLoadingItems ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : packItems.length === 0 ? (
                <div className="text-center py-8">
                  <Image className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">Нет фото в этом паке</p>
                  <button
                    onClick={() => setIsItemModalOpen(true)}
                    className="mt-3 text-blue-600 text-sm hover:underline"
                  >
                    Добавить первое фото
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {packItems.map((item) => (
                    <div
                      key={item.id}
                      className="group relative aspect-square rounded-lg overflow-hidden bg-slate-100"
                    >
                      <img
                        src={item.photo_url}
                        alt={`Item ${item.id}`}
                        className="w-full h-full object-cover"
                      />

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors">
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Position badge */}
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/50 text-white text-xs rounded">
                        #{item.position + 1}
                      </div>

                      {/* Prompt indicator */}
                      {item.prompt && (
                        <div className="absolute bottom-1 right-1 p-1 bg-black/50 text-white rounded" title={item.prompt}>
                          <FileText className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Выберите фотопак для просмотра</p>
          </div>
        )}
      </div>

      {/* Pack Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md m-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingPack ? 'Редактировать пак' : 'Новый фотопак'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Название *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Название пака"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Описание</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Описание фотопака..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">URL обложки</label>
                <input
                  type="text"
                  value={formData.cover_url}
                  onChange={(e) => setFormData({ ...formData, cover_url: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pack_is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="pack_is_active" className="text-sm text-slate-700">
                  Активный (виден пользователям)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                Отмена
              </button>
              <button
                onClick={handleSavePack}
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

      {/* Add Item Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md m-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Добавить фото</h3>
              <button onClick={() => setIsItemModalOpen(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">URL фото *</label>
                <input
                  type="text"
                  value={itemFormData.photo_url}
                  onChange={(e) => setItemFormData({ ...itemFormData, photo_url: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Связанный промпт</label>
                <textarea
                  value={itemFormData.prompt}
                  onChange={(e) => setItemFormData({ ...itemFormData, prompt: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Промпт, использованный для этого фото..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
              <button onClick={() => setIsItemModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                Отмена
              </button>
              <button
                onClick={handleAddItem}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
