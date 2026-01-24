'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2,
  ArrowLeft,
  Save,
  Beaker,
  Send,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check
} from 'lucide-react'

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

interface Pack {
  id: number
  name: string
  slug: string
  description: string | null
  iconEmoji: string | null
  previewImages: string[]
  moderationStatus: 'draft' | 'pending' | 'approved' | 'rejected'
  isActive: boolean
  isFeatured: boolean
  usageCount: number
  submittedAt: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
}

const statusConfig = {
  draft: { label: 'Черновик', color: 'bg-gray-500/10 text-gray-500', icon: null },
  pending: { label: 'На модерации', color: 'bg-yellow-500/10 text-yellow-600', icon: Loader2 },
  approved: { label: 'Одобрен', color: 'bg-green-500/10 text-green-600', icon: Check },
  rejected: { label: 'Отклонён', color: 'bg-red-500/10 text-red-600', icon: AlertCircle },
}

export default function PartnerPackEditPage() {
  const params = useParams()
  const router = useRouter()
  const packId = typeof params.id === 'string' ? parseInt(params.id) : 0

  const [pack, setPack] = useState<Pack | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [iconEmoji, setIconEmoji] = useState('🎨')

  // Expanded prompts
  const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(new Set())

  const fetchPack = useCallback(async () => {
    const telegramUserId = localStorage.getItem('pinglass_telegram_user_id')
    if (!telegramUserId) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/partner/packs/${packId}?telegram_user_id=${telegramUserId}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to fetch pack')
      }
      const data = await res.json()
      setPack(data.pack)
      setPrompts(data.prompts || [])
      setName(data.pack.name)
      setDescription(data.pack.description || '')
      setIconEmoji(data.pack.iconEmoji || '🎨')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [packId])

  useEffect(() => {
    if (packId > 0) {
      fetchPack()
    }
  }, [packId, fetchPack])

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Введите название пака')
      return
    }

    const telegramUserId = localStorage.getItem('pinglass_telegram_user_id')
    if (!telegramUserId) return

    try {
      setSaving(true)
      const res = await fetch(`/api/partner/packs/${packId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUserId: parseInt(telegramUserId),
          name: name.trim(),
          description: description.trim() || null,
          iconEmoji: iconEmoji || '🎨',
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to save pack')
      }

      const data = await res.json()
      setPack(data.pack)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitForReview = async () => {
    if (prompts.length < 7) {
      alert('Минимум 7 промптов для отправки на модерацию')
      return
    }

    const telegramUserId = localStorage.getItem('pinglass_telegram_user_id')
    if (!telegramUserId) return

    if (!confirm('Отправить пак на модерацию? После отправки редактирование будет недоступно до решения модератора.')) {
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch(`/api/partner/packs/${packId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUserId: parseInt(telegramUserId),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to submit pack')
      }

      await fetchPack()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка отправки')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePrompt = async (promptId: number) => {
    if (!confirm('Удалить этот промпт?')) return

    const telegramUserId = localStorage.getItem('pinglass_telegram_user_id')
    if (!telegramUserId) return

    try {
      const res = await fetch(`/api/partner/packs/${packId}/prompts/${promptId}?telegram_user_id=${telegramUserId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to delete prompt')
      }

      setPrompts(prompts.filter(p => p.id !== promptId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка удаления')
    }
  }

  const togglePromptExpanded = (promptId: number) => {
    setExpandedPrompts(prev => {
      const next = new Set(prev)
      if (next.has(promptId)) {
        next.delete(promptId)
      } else {
        next.add(promptId)
      }
      return next
    })
  }

  const canEdit = pack?.moderationStatus === 'draft' || pack?.moderationStatus === 'rejected'
  const canSubmit = canEdit && prompts.length >= 7

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
        <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
        <h2 className="text-lg font-medium text-destructive">Error</h2>
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

  const status = statusConfig[pack.moderationStatus]
  const StatusIcon = status.icon

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/partner/packs"
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{pack.name}</h1>
              <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${status.color}`}>
                {StatusIcon && <StatusIcon className="w-3 h-3" />}
                {status.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {prompts.length}/23 промптов
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/partner/packs/${packId}/test`}
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
          >
            <Beaker className="w-4 h-4" />
            <span className="hidden sm:inline">Тестировать</span>
          </Link>
        </div>
      </div>

      {/* Rejection reason */}
      {pack.moderationStatus === 'rejected' && pack.rejectionReason && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-500">Пак отклонён</h3>
              <p className="text-sm text-red-400 mt-1">{pack.rejectionReason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Pack Info Form */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Информация о паке</h2>

        <div>
          <label className="block text-sm font-medium mb-2">Название</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            className="w-full px-3 py-2 rounded-lg bg-background border text-sm disabled:opacity-50"
            placeholder="Бизнес-стиль"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit}
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-background border text-sm resize-none disabled:opacity-50"
            placeholder="Профессиональные портреты для LinkedIn..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Иконка</label>
          <input
            type="text"
            value={iconEmoji}
            onChange={(e) => setIconEmoji(e.target.value)}
            disabled={!canEdit}
            className="w-20 px-3 py-2 rounded-lg bg-background border text-center text-2xl disabled:opacity-50"
            maxLength={2}
          />
        </div>

        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Сохранить
          </button>
        )}
      </div>

      {/* Prompts List */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Промпты ({prompts.length}/23)</h2>
          {canEdit && (
            <Link
              href={`/partner/packs/${packId}/test`}
              className="text-sm text-primary hover:underline"
            >
              + Добавить через тестирование
            </Link>
          )}
        </div>

        {prompts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Пока нет промптов</p>
            <p className="text-sm mt-1">
              Перейдите в раздел тестирования, чтобы добавить промпты
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {prompts.map((prompt, index) => (
              <div
                key={prompt.id}
                className="border rounded-lg overflow-hidden"
              >
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => togglePromptExpanded(prompt.id)}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium w-6">{index + 1}.</span>

                  {prompt.previewUrl && (
                    <div className="w-10 h-10 rounded overflow-hidden shrink-0">
                      <img
                        src={prompt.previewUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <p className="flex-1 text-sm truncate">
                    {prompt.prompt}
                  </p>

                  {expandedPrompts.has(prompt.id) ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>

                {expandedPrompts.has(prompt.id) && (
                  <div className="px-3 pb-3 pt-0 border-t bg-muted/30">
                    <div className="pt-3 space-y-3">
                      <div className="flex gap-3">
                        {prompt.previewUrl && (
                          <div className="w-32 h-40 rounded-lg overflow-hidden shrink-0">
                            <img
                              src={prompt.previewUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 space-y-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Промпт</label>
                            <p className="text-sm">{prompt.prompt}</p>
                          </div>
                          {prompt.negativePrompt && (
                            <div>
                              <label className="text-xs text-muted-foreground">Negative</label>
                              <p className="text-sm text-muted-foreground">{prompt.negativePrompt}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {canEdit && (
                        <div className="flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeletePrompt(prompt.id)
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                            Удалить
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit for review */}
      {canEdit && (
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Отправить на модерацию</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {prompts.length < 7
                  ? `Нужно ещё ${7 - prompts.length} промптов (минимум 7)`
                  : 'Пак готов к отправке на модерацию'}
              </p>
            </div>
            <button
              onClick={handleSubmitForReview}
              disabled={!canSubmit || submitting}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Отправить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
