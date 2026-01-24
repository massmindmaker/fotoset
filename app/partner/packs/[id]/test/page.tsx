'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ArrowLeft, Plus, AlertCircle } from 'lucide-react'
import { ReferenceUploader } from '@/components/admin/ReferenceUploader'
import { PartnerTestBlock } from '@/components/partner/PartnerTestBlock'
import type { ReferenceImage, TestBlock as TestBlockType } from '@/lib/admin/types'

interface Pack {
  id: number
  name: string
  moderationStatus: 'draft' | 'pending' | 'approved' | 'rejected'
}

export default function PartnerPackTestPage() {
  const params = useParams()
  const router = useRouter()
  const packId = typeof params.id === 'string' ? parseInt(params.id) : 0

  const [pack, setPack] = useState<Pack | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [promptCount, setPromptCount] = useState(0)

  // Reference images (shared across all test blocks)
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([])

  // Test blocks
  const [testBlocks, setTestBlocks] = useState<TestBlockType[]>([
    {
      id: 'block-1',
      prompt: '',
      photoCount: 1,
      status: 'idle',
    },
  ])

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
      setPromptCount(data.prompts?.length || 0)
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

  // Convert ReferenceImage[] to base64 strings for API
  const getBase64Images = useCallback(async (): Promise<string[]> => {
    const promises = referenceImages.map((img) => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(img.file)
      })
    })
    return Promise.all(promises)
  }, [referenceImages])

  const [base64Images, setBase64Images] = useState<string[]>([])

  // Update base64 images when reference images change
  useEffect(() => {
    if (referenceImages.length >= 5) {
      getBase64Images().then(setBase64Images)
    } else {
      setBase64Images([])
    }
  }, [referenceImages, getBase64Images])

  const handleUpdateBlock = useCallback((id: string, updates: Partial<TestBlockType>) => {
    setTestBlocks((prev) =>
      prev.map((block) =>
        block.id === id ? { ...block, ...updates } : block
      )
    )
  }, [])

  const handleRemoveBlock = useCallback((id: string) => {
    setTestBlocks((prev) => prev.filter((block) => block.id !== id))
  }, [])

  const handleAddBlock = useCallback(() => {
    const newBlock: TestBlockType = {
      id: `block-${Date.now()}`,
      prompt: '',
      photoCount: 1,
      status: 'idle',
    }
    setTestBlocks((prev) => [...prev, newBlock])
  }, [])

  const handlePromptSaved = useCallback(() => {
    setPromptCount((prev) => prev + 1)
  }, [])

  const canEdit = pack?.moderationStatus === 'draft' || pack?.moderationStatus === 'rejected'
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

  if (!canEdit) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
        <h2 className="text-lg font-medium">Редактирование недоступно</h2>
        <p className="text-muted-foreground mt-2">
          Пак находится на модерации или уже одобрен
        </p>
        <Link
          href={`/partner/packs/${packId}`}
          className="inline-block mt-4 text-primary hover:underline"
        >
          Вернуться к паку
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/partner/packs/${packId}`}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Тестирование промптов</h1>
          <p className="text-sm text-muted-foreground">
            {pack.name} &bull; {promptCount}/23 промптов
          </p>
        </div>
      </div>

      {/* Reference Uploader */}
      <div className="bg-card border rounded-xl p-6">
        <ReferenceUploader
          images={referenceImages}
          onImagesChange={setReferenceImages}
          minPhotos={5}
          maxPhotos={10}
        />
      </div>

      {/* Test Blocks */}
      {isReady && (
        <>
          <div className="space-y-4">
            {testBlocks.map((block) => (
              <PartnerTestBlock
                key={block.id}
                block={block}
                packId={packId}
                referenceImages={base64Images}
                onUpdate={handleUpdateBlock}
                onRemove={handleRemoveBlock}
                onPromptSaved={handlePromptSaved}
                isOnlyBlock={testBlocks.length === 1}
              />
            ))}
          </div>

          {/* Add block button */}
          <button
            onClick={handleAddBlock}
            className="w-full py-4 border-2 border-dashed rounded-xl text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Добавить тест-блок
          </button>

          {/* Tips */}
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4">
            <h3 className="font-medium mb-2">Советы</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Тестируйте промпты с разными вариациями</li>
              <li>• Выбирайте лучшее фото перед сохранением</li>
              <li>• Минимум 7 промптов для отправки на модерацию</li>
              <li>• Рекомендуется 15-23 промпта для полноценного пака</li>
            </ul>
          </div>
        </>
      )}

      {!isReady && (
        <div className="text-center py-8 text-muted-foreground">
          <p>Загрузите минимум 5 референсных фото для начала тестирования</p>
        </div>
      )}
    </div>
  )
}
