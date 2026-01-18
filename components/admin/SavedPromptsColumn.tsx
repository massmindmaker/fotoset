'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  RefreshCw,
  Plus,
  Star,
  Package,
  Loader2,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  Image as ImageIcon,
  Eye,
  Filter,
} from 'lucide-react'
import { usePromptsContext, SavedPrompt } from './PromptsContext'
import { PromptCard } from './PromptCard'

type FilterType = 'all' | 'favorite' | 'professional' | 'lifestyle' | 'creative'

export function SavedPromptsColumn() {
  const {
    registerPromptsRefresh,
    openAddToPackPopover,
  } = usePromptsContext()

  const [prompts, setPrompts] = useState<SavedPrompt[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')

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

  // Import states
  const [isImporting, setIsImporting] = useState(false)
  const [isImportingPinGlass, setIsImportingPinGlass] = useState(false)

  // Preview generation
  const [isGeneratingPreviews, setIsGeneratingPreviews] = useState(false)
  const [previewReferenceUrl, setPreviewReferenceUrl] = useState('')
  const [showReferenceInput, setShowReferenceInput] = useState(false)

  // Added to pack tracking
  const [addedToPackMap, setAddedToPackMap] = useState<Record<number, number>>({})

  const fetchPrompts = useCallback(async (page = 1) => {
    setIsLoading(true)
    setError(null)
    try {
      let url = `/api/admin/prompts?page=${page}&limit=12`
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`
      if (filter === 'favorite') url += '&favorite=true'
      else if (filter !== 'all') url += `&style=${filter}`

      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch prompts')
      const data = await response.json()
      setPrompts(data.prompts || [])
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, filter])

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  // Register refresh callback with context
  useEffect(() => {
    registerPromptsRefresh(() => fetchPrompts(pagination.page))
  }, [registerPromptsRefresh, pagination.page, fetchPrompts])

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
    } catch {
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

  const importDreamPack = async () => {
    if (!confirm('Импортировать DREAM PACK (17 промптов)?')) return

    setIsImporting(true)
    try {
      const response = await fetch('/api/admin/packs/dreampack/import', { method: 'POST' })
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

  const importPinGlassPack = async () => {
    if (!confirm('Импортировать PinGlass Premium (23 оригинальных промпта)?')) return

    setIsImportingPinGlass(true)
    try {
      const response = await fetch('/api/admin/packs/pinglass/import', { method: 'POST' })
      if (!response.ok) throw new Error('Import failed')

      const data = await response.json()
      alert(`PinGlass Premium: импортировано ${data.imported}, пропущено ${data.skipped}`)
      fetchPrompts(1)
    } catch (err) {
      alert('Ошибка импорта: ' + (err instanceof Error ? err.message : 'Unknown'))
    } finally {
      setIsImportingPinGlass(false)
    }
  }

  const generateAllPreviews = async () => {
    const promptsWithoutPreview = prompts.filter(p => !p.preview_url).length
    if (promptsWithoutPreview === 0) {
      alert('Все промпты уже имеют превью')
      return
    }

    if (!confirm(`Сгенерировать превью для ${promptsWithoutPreview} промптов?`)) {
      return
    }

    setIsGeneratingPreviews(true)
    try {
      const response = await fetch('/api/admin/prompts/generate-preview/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          all: true,
          referenceImageUrl: previewReferenceUrl || undefined
        })
      })

      if (!response.ok) throw new Error('Generation failed')

      const data = await response.json()
      alert(`Генерация завершена!\nУспешно: ${data.generated}\nОшибок: ${data.failed}`)
      fetchPrompts(pagination.page)
    } catch (err) {
      alert('Ошибка генерации: ' + (err instanceof Error ? err.message : 'Unknown'))
    } finally {
      setIsGeneratingPreviews(false)
      setShowReferenceInput(false)
    }
  }

  const generateSinglePreview = async (promptId: number) => {
    try {
      const response = await fetch('/api/admin/prompts/generate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptId,
          referenceImageUrl: previewReferenceUrl || undefined
        })
      })

      if (!response.ok) throw new Error('Generation failed')
      fetchPrompts(pagination.page)
    } catch (err) {
      alert('Ошибка генерации: ' + (err instanceof Error ? err.message : 'Unknown'))
    }
  }

  const handleAddToPack = (prompt: SavedPrompt) => {
    openAddToPackPopover({
      promptId: prompt.id,
      imageUrl: prompt.preview_url || '',
      prompt: prompt.prompt,
    })
  }

  const filters: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'favorite', label: '⭐' },
    { id: 'professional', label: 'Prof' },
    { id: 'lifestyle', label: 'Life' },
    { id: 'creative', label: 'Creative' },
  ]

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Сохранённые ({pagination.total})
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchPrompts(pagination.page)}
              disabled={isLoading}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              title="Обновить"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openCreateModal}
              className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              title="Добавить промпт"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск промптов..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                filter === f.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Import & Preview Actions (compact) */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={importPinGlassPack}
            disabled={isImportingPinGlass}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg hover:from-pink-600 hover:to-rose-600 disabled:opacity-50"
          >
            {isImportingPinGlass ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
            PinGlass
          </button>
          <button
            onClick={importDreamPack}
            disabled={isImporting}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
          >
            {isImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
            DREAM
          </button>
          <div className="flex-1" />
          {showReferenceInput && (
            <input
              type="text"
              value={previewReferenceUrl}
              onChange={(e) => setPreviewReferenceUrl(e.target.value)}
              placeholder="URL референса"
              className="w-32 px-2 py-1 text-xs border border-slate-300 rounded-lg"
            />
          )}
          <button
            onClick={() => setShowReferenceInput(!showReferenceInput)}
            className="p-1 rounded hover:bg-slate-200 text-slate-500"
            title="Референс для превью"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={generateAllPreviews}
            disabled={isGeneratingPreviews || prompts.filter(p => !p.preview_url).length === 0}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {isGeneratingPreviews ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
            Превью
          </button>
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
        ) : prompts.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">
              {searchQuery || filter !== 'all' ? 'Промпты не найдены' : 'Нет сохранённых промптов'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {prompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                onEdit={() => openEditModal(prompt)}
                onDelete={() => handleDelete(prompt.id)}
                onAddToPack={() => handleAddToPack(prompt)}
                onToggleFavorite={() => toggleFavorite(prompt)}
                onCopy={() => copyPrompt(prompt.prompt)}
                onGeneratePreview={() => generateSinglePreview(prompt.id)}
                isAddedToPack={!!addedToPackMap[prompt.id]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-center gap-2 p-3 border-t border-slate-200">
          <button
            onClick={() => fetchPrompts(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="p-1.5 rounded-lg bg-white border border-slate-200 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-600">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchPrompts(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="p-1.5 rounded-lg bg-white border border-slate-200 disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto m-4">
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
                  placeholder="Что исключить..."
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
                    <option value="pinglass">PinGlass Premium</option>
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
                    placeholder="тег1, тег2"
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
                  Избранное
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
