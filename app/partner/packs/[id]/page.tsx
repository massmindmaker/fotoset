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
  Edit2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  FlaskConical,
  Package,
  Info,
} from 'lucide-react'
import { ReferenceUploader } from '@/components/admin/ReferenceUploader'
import { PartnerTestBlock, PartnerQuotaIndicator, PartnerPromptsList } from '@/components/partner'
import type { ReferenceImage } from '@/lib/admin/types'

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

interface TestBlock {
  id: string
  prompt: string
  photoCount: 1 | 2 | 3 | 4
  status: 'idle' | 'generating' | 'completed' | 'failed'
  results?: Array<{
    imageUrl: string
    latency: number
    taskId: string
    aspectRatio?: string
  }>
  error?: string
  startedAt?: number
  completedAt?: number
}

interface Quota {
  limit: number
  used: number
  remaining: number
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

  // Quota
  const [quota, setQuota] = useState<Quota>({ limit: 200, used: 0, remaining: 200 })

  // Reference images (shared for all test blocks)
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([])
  const [referenceBase64Urls, setReferenceBase64Urls] = useState<string[]>([])

  // Test blocks
  const [testBlocks, setTestBlocks] = useState<TestBlock[]>([
    {
      id: '1',
      prompt: '',
      photoCount: 1,
      status: 'idle',
    },
  ])

  // Edit pack form
  const [editMode, setEditMode] = useState(false)
  const [packForm, setPackForm] = useState({
    name: '',
    description: '',
    iconEmoji: '',
  })
  const [saving, setSaving] = useState(false)

  // Submit for moderation
  const [submitting, setSubmitting] = useState(false)

  // Fetch pack data
  const fetchPack = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/partner/packs/${packId}`, {
        credentials: 'include',
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
        iconEmoji: data.pack.iconEmoji || '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [packId, router])

  // Fetch quota
  const fetchQuota = useCallback(async () => {
    try {
      const res = await fetch('/api/partner/test-quota', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setQuota(data.quota)
      }
    } catch (err) {
      console.error('[EditPackPage] Failed to fetch quota:', err)
    }
  }, [])

  useEffect(() => {
    fetchPack()
    fetchQuota()
  }, [fetchPack, fetchQuota])

  // Convert reference images to base64
  useEffect(() => {
    const convertToBase64 = async () => {
      const urls: string[] = []
      for (const img of referenceImages) {
        try {
          const base64 = await fileToBase64(img.file)
          urls.push(base64)
        } catch (error) {
          console.error('[EditPackPage] Failed to convert image:', error)
        }
      }
      setReferenceBase64Urls(urls)
    }

    if (referenceImages.length > 0) {
      convertToBase64()
    } else {
      setReferenceBase64Urls([])
    }
  }, [referenceImages])

  // Test block handlers
  const addTestBlock = () => {
    const newBlock: TestBlock = {
      id: Date.now().toString(),
      prompt: '',
      photoCount: 1,
      status: 'idle',
    }
    setTestBlocks([...testBlocks, newBlock])
  }

  const updateTestBlock = (id: string, updates: Partial<TestBlock>) => {
    setTestBlocks((blocks) =>
      blocks.map((block) =>
        block.id === id ? { ...block, ...updates } : block
      )
    )
  }

  const removeTestBlock = (id: string) => {
    if (testBlocks.length === 1) {
      alert('Должен быть хотя бы один тестовый блок')
      return
    }
    setTestBlocks((blocks) => blocks.filter((block) => block.id !== id))
  }

  // Add prompt to pack from test block
  const handleAddToPack = async (prompt: string, previewUrl: string) => {
    try {
      const res = await fetch(`/api/partner/packs/${packId}/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: prompt.trim(),
          previewUrl: previewUrl,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Ошибка добавления')
      }

      // Refresh prompts list
      fetchPack()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка добавления в пак')
    }
  }

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
          iconEmoji: packForm.iconEmoji.trim() || null,
        }),
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

    if (
      !confirm(
        'Отправить пак на модерацию? После этого редактирование будет недоступно до завершения проверки.'
      )
    ) {
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/partner/packs/${packId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to submit pack')
      }

      fetchPack()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка отправки')
    } finally {
      setSubmitting(false)
    }
  }

  // Status helpers
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Edit2 className="w-4 h-4" />
      case 'pending':
        return <Clock className="w-4 h-4" />
      case 'approved':
        return <CheckCircle className="w-4 h-4" />
      case 'rejected':
        return <XCircle className="w-4 h-4" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-500/10 text-gray-500'
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600'
      case 'approved':
        return 'bg-green-500/10 text-green-600'
      case 'rejected':
        return 'bg-red-500/10 text-red-600'
      default:
        return ''
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Черновик'
      case 'pending':
        return 'На модерации'
      case 'approved':
        return 'Одобрен'
      case 'rejected':
        return 'Отклонён'
      default:
        return status
    }
  }

  const canEdit =
    pack?.moderationStatus === 'draft' || pack?.moderationStatus === 'rejected'
  const canSubmit = canEdit && prompts.length >= 7 && prompts.length <= 23
  const isReady = referenceImages.length >= 5

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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 pb-4 border-b border-slate-200 mb-4">
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
                <h1 className="text-xl font-bold">{pack.name}</h1>
                <span
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full ${getStatusColor(
                    pack.moderationStatus
                  )}`}
                >
                  {getStatusIcon(pack.moderationStatus)}
                  {getStatusLabel(pack.moderationStatus)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {prompts.length} промптов
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
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <p className="font-medium text-red-600 text-sm">Пак отклонён</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {pack.rejectionReason}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main 3-column layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        {/* Left Column: Tester (5 cols) */}
        <div className="lg:col-span-5 flex flex-col min-h-0 overflow-hidden">
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col h-full overflow-hidden">
            <div className="flex-shrink-0 p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-blue-600" />
                Тестер промптов
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Reference Images */}
              <ReferenceUploader
                images={referenceImages}
                onImagesChange={setReferenceImages}
                minPhotos={5}
                maxPhotos={10}
              />

              {/* Test Blocks */}
              {isReady && canEdit && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-800">
                      Тестовые блоки
                    </h4>
                    <button
                      onClick={addTestBlock}
                      className="px-3 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Добавить
                    </button>
                  </div>

                  {testBlocks.map((block) => (
                    <PartnerTestBlock
                      key={block.id}
                      block={block}
                      referenceImages={referenceBase64Urls}
                      onUpdate={updateTestBlock}
                      onRemove={removeTestBlock}
                      isOnlyBlock={testBlocks.length === 1}
                      onAddToPack={handleAddToPack}
                      quotaRemaining={quota.remaining}
                      onQuotaUpdate={(remaining) =>
                        setQuota({ ...quota, remaining, used: quota.limit - remaining })
                      }
                    />
                  ))}
                </div>
              )}

              {/* Not ready message */}
              {!isReady && referenceImages.length > 0 && (
                <div className="bg-pink-50 rounded-xl p-3 border border-pink-200">
                  <p className="text-sm text-slate-700 text-center">
                    Загрузите ещё {5 - referenceImages.length} фото
                  </p>
                </div>
              )}

              {/* Locked message for non-editable packs */}
              {!canEdit && (
                <div className="bg-slate-50 rounded-xl p-6 text-center border border-slate-200">
                  <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">
                    Пак находится на модерации. Редактирование недоступно.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Column: Prompts List (4 cols) */}
        <div className="lg:col-span-4 min-h-0 overflow-hidden">
          <PartnerPromptsList
            prompts={prompts}
            packId={parseInt(packId)}
            canEdit={canEdit}
            onRefresh={fetchPack}
          />
        </div>

        {/* Right Column: Pack Info (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0 overflow-y-auto">
          {/* Quota Indicator */}
          <PartnerQuotaIndicator
            limit={quota.limit}
            used={quota.used}
          />

          {/* Pack Info Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-500" />
                Информация
              </h3>
              {canEdit && !editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-slate-500" />
                </button>
              )}
            </div>

            {editMode ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Название *
                  </label>
                  <input
                    type="text"
                    value={packForm.name}
                    onChange={(e) =>
                      setPackForm({ ...packForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Описание
                  </label>
                  <textarea
                    value={packForm.description}
                    onChange={(e) =>
                      setPackForm({ ...packForm, description: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Иконка
                  </label>
                  <input
                    type="text"
                    value={packForm.iconEmoji}
                    onChange={(e) =>
                      setPackForm({ ...packForm, iconEmoji: e.target.value })
                    }
                    className="w-16 px-3 py-2 text-center text-lg bg-slate-50 border border-slate-200 rounded-lg"
                    maxLength={2}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditMode(false)}
                    className="flex-1 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleSavePack}
                    disabled={saving}
                    className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
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
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{pack.iconEmoji || '📦'}</span>
                  <div>
                    <p className="font-medium text-slate-800">{pack.name}</p>
                    <p className="text-xs text-slate-500">/{pack.slug}</p>
                  </div>
                </div>
                {pack.description && (
                  <p className="text-sm text-slate-600">{pack.description}</p>
                )}
                <p className="text-xs text-slate-400">
                  Создан {new Date(pack.createdAt).toLocaleDateString('ru')}
                </p>
              </div>
            )}
          </div>

          {/* Submit Status */}
          {canEdit && (
            <div
              className={`rounded-xl p-4 border ${
                prompts.length < 7
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-green-50 border-green-200'
              }`}
            >
              <div className="flex gap-3">
                {prompts.length < 7 ? (
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                )}
                <div className="text-sm">
                  {prompts.length < 7 ? (
                    <>
                      <p className="font-medium text-amber-700">
                        Недостаточно промптов
                      </p>
                      <p className="text-amber-600 text-xs mt-1">
                        Добавьте ещё {7 - prompts.length} промптов
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-green-700">
                        Готово к отправке
                      </p>
                      <p className="text-green-600 text-xs mt-1">
                        {prompts.length} промптов
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
            <h4 className="font-medium text-slate-800 mb-2 flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-500" />
              Как создать пак
            </h4>
            <ol className="text-xs text-slate-600 space-y-1.5">
              <li>1. Загрузите 5-10 референсных фото</li>
              <li>2. Напишите промпт и нажмите «Генерировать»</li>
              <li>3. Если результат хороший — «Добавить в пак»</li>
              <li>4. Повторите для 7-23 промптов</li>
              <li>5. Отправьте на модерацию</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper: Convert File to base64 data URI
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to convert to base64'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
