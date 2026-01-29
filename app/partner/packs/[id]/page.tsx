'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  Save,
  Send,
  Plus,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  GripVertical
} from 'lucide-react'

interface Pack {
  id: number
  name: string
  slug: string
  description: string | null
  iconEmoji: string
  previewImages: string[]
  moderationStatus: 'draft' | 'pending' | 'approved' | 'rejected'
  isActive: boolean
  submittedAt: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
}

interface Prompt {
  id: number
  prompt: string
  negativePrompt: string | null
  stylePrefix: string | null
  styleSuffix: string | null
  previewUrl: string | null
  position: number
  isActive: boolean
  createdAt: string
}

export default function EditPackPage() {
  const router = useRouter()
  const params = useParams()
  const packId = params.id as string

  // Pack data
  const [pack, setPack] = useState<Pack | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit pack form
  const [editMode, setEditMode] = useState(false)
  const [packForm, setPackForm] = useState({
    name: '',
    description: '',
    iconEmoji: ''
  })
  const [saving, setSaving] = useState(false)

  // Prompt modal
  const [promptModal, setPromptModal] = useState<{
    open: boolean
    editing: Prompt | null
  }>({ open: false, editing: null })
  const [promptForm, setPromptForm] = useState({
    prompt: '',
    negativePrompt: '',
    stylePrefix: '',
    styleSuffix: ''
  })
  const [savingPrompt, setSavingPrompt] = useState(false)

  // Submit for moderation
  const [submitting, setSubmitting] = useState(false)

  const fetchPack = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/partner/packs/${packId}`, {
        credentials: 'include'
      })

      if (!res.ok) {
        const data = await res.json()
        if (res.status === 401 || res.status === 403) {
          router.replace('/partner/login')
          return
        }
        throw new Error(data.message || data.error || 'Failed to fetch pack')
      }

      const data = await res.json()
      setPack(data.pack)
      setPrompts(data.prompts || [])
      setPackForm({
        name: data.pack.name,
        description: data.pack.description || '',
        iconEmoji: data.pack.iconEmoji || ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [packId, router])

  useEffect(() => {
    fetchPack()
  }, [fetchPack])

  // Save pack changes
  const handleSavePack = async () => {
    if (!packForm.name.trim()) {
      alert('Название пака обязательно')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/partner/packs/${packId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: packForm.name.trim(),
          description: packForm.description.trim() || null,
          iconEmoji: packForm.iconEmoji.trim() || null
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to update pack')
      }

      const data = await res.json()
      setPack(data.pack)
      setEditMode(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  // Open prompt modal
  const openPromptModal = (prompt?: Prompt) => {
    if (prompt) {
      setPromptForm({
        prompt: prompt.prompt,
        negativePrompt: prompt.negativePrompt || '',
        stylePrefix: prompt.stylePrefix || '',
        styleSuffix: prompt.styleSuffix || ''
      })
      setPromptModal({ open: true, editing: prompt })
    } else {
      setPromptForm({
        prompt: '',
        negativePrompt: '',
        stylePrefix: '',
        styleSuffix: ''
      })
      setPromptModal({ open: true, editing: null })
    }
  }

  // Save prompt
  const handleSavePrompt = async () => {
    if (!promptForm.prompt.trim()) {
      alert('Промпт обязателен')
      return
    }

    setSavingPrompt(true)
    try {
      const isEditing = !!promptModal.editing
      const url = isEditing
        ? `/api/partner/packs/${packId}/prompts/${promptModal.editing!.id}`
        : `/api/partner/packs/${packId}/prompts`

      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: promptForm.prompt.trim(),
          negativePrompt: promptForm.negativePrompt.trim() || null,
          stylePrefix: promptForm.stylePrefix.trim() || null,
          styleSuffix: promptForm.styleSuffix.trim() || null
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to save prompt')
      }

      setPromptModal({ open: false, editing: null })
      fetchPack() // Refresh prompts
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setSavingPrompt(false)
    }
  }

  // Delete prompt
  const handleDeletePrompt = async (promptId: number) => {
    if (!confirm('Удалить этот промпт?')) return

    try {
      const res = await fetch(`/api/partner/packs/${packId}/prompts/${promptId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to delete prompt')
      }

      fetchPack() // Refresh prompts
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка удаления')
    }
  }

  // Submit for moderation
  const handleSubmit = async () => {
    if (prompts.length < 7) {
      alert(`Необходимо минимум 7 промптов (сейчас ${prompts.length})`)
      return
    }
    if (prompts.length > 23) {
      alert(`Максимум 23 промпта (сейчас ${prompts.length})`)
      return
    }

    if (!confirm('Отправить пак на модерацию? После этого редактирование будет недоступно до завершения проверки.')) {
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/partner/packs/${packId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to submit pack')
      }

      fetchPack() // Refresh pack status
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка отправки')
    } finally {
      setSubmitting(false)
    }
  }

  // Status helpers
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Edit2 className="w-4 h-4" />
      case 'pending': return <Clock className="w-4 h-4" />
      case 'approved': return <CheckCircle className="w-4 h-4" />
      case 'rejected': return <XCircle className="w-4 h-4" />
      default: return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500/10 text-gray-500'
      case 'pending': return 'bg-yellow-500/10 text-yellow-600'
      case 'approved': return 'bg-green-500/10 text-green-600'
      case 'rejected': return 'bg-red-500/10 text-red-600'
      default: return ''
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Черновик'
      case 'pending': return 'На модерации'
      case 'approved': return 'Одобрен'
      case 'rejected': return 'Отклонён'
      default: return status
    }
  }

  const canEdit = pack?.moderationStatus === 'draft' || pack?.moderationStatus === 'rejected'
  const canSubmit = canEdit && prompts.length >= 7 && prompts.length <= 23

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !pack) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium text-red-500">Ошибка загрузки</h2>
        <p className="text-muted-foreground mt-2">{error || 'Pack not found'}</p>
        <Link
          href="/partner/packs"
          className="inline-block mt-4 text-primary hover:underline"
        >
          Вернуться к пакам
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/partner/packs"
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{pack.name}</h1>
              <span className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full ${getStatusColor(pack.moderationStatus)}`}>
                {getStatusIcon(pack.moderationStatus)}
                {getStatusLabel(pack.moderationStatus)}
              </span>
            </div>
            <p className="text-muted-foreground">
              {prompts.length} промптов • Создан {new Date(pack.createdAt).toLocaleDateString('ru')}
            </p>
          </div>
        </div>

        {canSubmit && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            На модерацию
          </button>
        )}
      </div>

      {/* Rejection reason */}
      {pack.moderationStatus === 'rejected' && pack.rejectionReason && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-600">Пак отклонён</p>
              <p className="text-sm text-muted-foreground mt-1">{pack.rejectionReason}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Исправьте замечания и отправьте пак на модерацию повторно.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pack Info Card */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Информация о паке</h2>
          {canEdit && !editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent rounded-lg transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Редактировать
            </button>
          )}
        </div>

        {editMode ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Название *</label>
              <input
                type="text"
                value={packForm.name}
                onChange={(e) => setPackForm({ ...packForm, name: e.target.value })}
                className="w-full px-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Описание</label>
              <textarea
                value={packForm.description}
                onChange={(e) => setPackForm({ ...packForm, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Иконка (emoji)</label>
              <input
                type="text"
                value={packForm.iconEmoji}
                onChange={(e) => setPackForm({ ...packForm, iconEmoji: e.target.value })}
                className="w-20 px-4 py-2 bg-background border rounded-lg text-center text-2xl"
                maxLength={2}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditMode(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Отмена
              </button>
              <button
                onClick={handleSavePack}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Сохранить
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{pack.iconEmoji || ''}</span>
              <div>
                <p className="font-medium">{pack.name}</p>
                <p className="text-sm text-muted-foreground">slug: {pack.slug}</p>
              </div>
            </div>
            {pack.description && (
              <p className="text-muted-foreground">{pack.description}</p>
            )}
          </div>
        )}
      </div>

      {/* Prompts Section */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Промпты ({prompts.length}/23)</h2>
            <p className="text-sm text-muted-foreground">
              Минимум 7, максимум 23 промпта
            </p>
          </div>
          {canEdit && prompts.length < 23 && (
            <button
              onClick={() => openPromptModal()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Добавить промпт
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                prompts.length < 7 ? 'bg-yellow-500' :
                prompts.length <= 23 ? 'bg-green-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min((prompts.length / 23) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0</span>
            <span className={prompts.length >= 7 ? 'text-green-500' : ''}>7 (мин)</span>
            <span>23 (макс)</span>
          </div>
        </div>

        {/* Prompts List */}
        {prompts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Пока нет промптов</p>
            {canEdit && (
              <button
                onClick={() => openPromptModal()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                Добавить первый промпт
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {prompts.map((prompt, index) => (
              <div
                key={prompt.id}
                className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg group"
              >
                <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                  <GripVertical className="w-4 h-4 opacity-0 group-hover:opacity-50" />
                  <span className="w-6 text-center text-sm">{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-2">{prompt.prompt}</p>
                  {prompt.negativePrompt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Negative: {prompt.negativePrompt}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openPromptModal(prompt)}
                      className="p-1.5 hover:bg-accent rounded"
                      title="Редактировать"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePrompt(prompt.id)}
                      className="p-1.5 hover:bg-red-500/10 text-red-500 rounded"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Info */}
      {canEdit && (
        <div className={`border rounded-lg p-4 ${
          prompts.length < 7 
            ? 'bg-yellow-500/10 border-yellow-500/20' 
            : 'bg-green-500/10 border-green-500/20'
        }`}>
          <div className="flex gap-3">
            {prompts.length < 7 ? (
              <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            )}
            <div className="text-sm">
              {prompts.length < 7 ? (
                <>
                  <p className="font-medium text-yellow-600">Недостаточно промптов</p>
                  <p className="text-muted-foreground mt-1">
                    Добавьте ещё {7 - prompts.length} промптов, чтобы отправить пак на модерацию
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-green-600">Готово к отправке</p>
                  <p className="text-muted-foreground mt-1">
                    Пак содержит {prompts.length} промптов и готов к модерации
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Prompt Modal */}
      {promptModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto m-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {promptModal.editing ? 'Редактировать промпт' : 'Новый промпт'}
              </h3>
              <button
                onClick={() => setPromptModal({ open: false, editing: null })}
                className="p-2 hover:bg-accent rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Промпт *</label>
                <textarea
                  value={promptForm.prompt}
                  onChange={(e) => setPromptForm({ ...promptForm, prompt: e.target.value })}
                  placeholder="Опишите стиль генерации..."
                  rows={4}
                  className="w-full px-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Негативный промпт</label>
                <textarea
                  value={promptForm.negativePrompt}
                  onChange={(e) => setPromptForm({ ...promptForm, negativePrompt: e.target.value })}
                  placeholder="Что исключить из генерации..."
                  rows={2}
                  className="w-full px-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Префикс стиля</label>
                  <input
                    type="text"
                    value={promptForm.stylePrefix}
                    onChange={(e) => setPromptForm({ ...promptForm, stylePrefix: e.target.value })}
                    placeholder="professional photo"
                    className="w-full px-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Суффикс стиля</label>
                  <input
                    type="text"
                    value={promptForm.styleSuffix}
                    onChange={(e) => setPromptForm({ ...promptForm, styleSuffix: e.target.value })}
                    placeholder="8k, detailed"
                    className="w-full px-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setPromptModal({ open: false, editing: null })}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Отмена
              </button>
              <button
                onClick={handleSavePrompt}
                disabled={savingPrompt || !promptForm.prompt.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {savingPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
