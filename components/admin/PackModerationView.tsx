'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Loader2,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  User,
  FileText
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'

interface PendingPack {
  id: number
  name: string
  iconEmoji: string | null
  description: string | null
  previewImages: string[]
  promptCount: number
  partnerUsername: string | null
  partnerUserId: number
  submittedAt: string
  prompts?: PackPrompt[]
}

interface PackPrompt {
  id: number
  name: string
  promptText: string
  negativePrompt: string | null
  order: number
}

/**
 * Admin view for moderating partner-submitted packs
 * Features: List pending packs, approve/reject with reason, expand to view prompts
 */
export function PackModerationView() {
  const [packs, setPacks] = useState<PendingPack[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [loadingPromptsId, setLoadingPromptsId] = useState<number | null>(null)

  // Reject modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectingPackId, setRejectingPackId] = useState<number | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const fetchPacks = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/packs/moderation')
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch packs')
      }

      const data = await response.json()
      setPacks(data.packs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPacks()
  }, [fetchPacks])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchPacks, 30000)
    return () => clearInterval(interval)
  }, [fetchPacks])

  const fetchPackPrompts = async (packId: number) => {
    if (packs.find(p => p.id === packId)?.prompts) {
      return // Already loaded
    }

    setLoadingPromptsId(packId)
    try {
      const response = await fetch(`/api/admin/packs/${packId}/prompts`)
      if (!response.ok) throw new Error('Failed to fetch prompts')

      const data = await response.json()
      setPacks(prev => prev.map(p =>
        p.id === packId ? { ...p, prompts: data.prompts } : p
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки промптов')
    } finally {
      setLoadingPromptsId(null)
    }
  }

  const handleExpand = async (packId: number) => {
    if (expandedId === packId) {
      setExpandedId(null)
    } else {
      setExpandedId(packId)
      await fetchPackPrompts(packId)
    }
  }

  const handleApprove = async (packId: number) => {
    if (!confirm('Одобрить этот пак? Он станет доступен для использования.')) return

    setProcessingId(packId)
    try {
      const response = await fetch(`/api/admin/packs/${packId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to approve')
      }

      // Remove from list
      setPacks(prev => prev.filter(p => p.id !== packId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка одобрения')
    } finally {
      setProcessingId(null)
    }
  }

  const openRejectModal = (packId: number) => {
    setRejectingPackId(packId)
    setRejectionReason('')
    setRejectModalOpen(true)
  }

  const handleReject = async () => {
    if (!rejectingPackId) return
    if (!rejectionReason.trim()) {
      setError('Укажите причину отклонения')
      return
    }

    setProcessingId(rejectingPackId)
    try {
      const response = await fetch(`/api/admin/packs/${rejectingPackId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          rejectionReason: rejectionReason.trim()
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reject')
      }

      // Remove from list and close modal
      setPacks(prev => prev.filter(p => p.id !== rejectingPackId))
      setRejectModalOpen(false)
      setRejectingPackId(null)
      setRejectionReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отклонения')
    } finally {
      setProcessingId(null)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Модерация паков</h2>
          <p className="text-sm text-slate-500 mt-1">
            {packs.length > 0
              ? `${packs.length} ${packs.length === 1 ? 'пак' : packs.length < 5 ? 'пака' : 'паков'} на модерации`
              : 'Все паки проверены'
            }
          </p>
        </div>
        <Button
          onClick={fetchPacks}
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            x
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && packs.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-3 text-slate-400 animate-spin" />
          <p className="text-slate-500">Загрузка паков...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && packs.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-medium text-slate-800 mb-2">Нет паков на модерации</h3>
          <p className="text-slate-500">Все партнёрские паки проверены</p>
        </div>
      )}

      {/* Packs List */}
      {packs.length > 0 && (
        <div className="space-y-4">
          {packs.map(pack => (
            <div
              key={pack.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Pack Card Header */}
              <div className="p-4">
                <div className="flex items-start gap-4">
                  {/* Preview Collage */}
                  <div className="grid grid-cols-2 gap-1 w-24 h-24 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden">
                    {pack.previewImages && pack.previewImages.length > 0 ? (
                      pack.previewImages.slice(0, 4).map((img, idx) => (
                        <div key={idx} className="relative w-full h-full">
                          <img
                            src={img}
                            alt={`Preview ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 row-span-2 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-slate-300" />
                      </div>
                    )}
                    {/* Fill empty slots */}
                    {pack.previewImages && pack.previewImages.length > 0 && pack.previewImages.length < 4 && (
                      Array.from({ length: 4 - pack.previewImages.length }).map((_, idx) => (
                        <div key={`empty-${idx}`} className="bg-slate-200 flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-slate-400" />
                        </div>
                      ))
                    )}
                  </div>

                  {/* Pack Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-slate-800 truncate">
                      {pack.iconEmoji && <span className="mr-2">{pack.iconEmoji}</span>}
                      {pack.name}
                    </h3>
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                      <User className="w-4 h-4" />
                      от @{pack.partnerUsername || `user_${pack.partnerUserId}`}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        {pack.promptCount} промптов
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(pack.submittedAt)}
                      </span>
                    </div>
                    {pack.description && (
                      <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                        {pack.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      onClick={() => handleApprove(pack.id)}
                      disabled={processingId === pack.id}
                      variant="success"
                      size="sm"
                    >
                      {processingId === pack.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Одобрить
                    </Button>
                    <Button
                      onClick={() => openRejectModal(pack.id)}
                      disabled={processingId === pack.id}
                      variant="destructive"
                      size="sm"
                    >
                      <XCircle className="w-4 h-4" />
                      Отклонить
                    </Button>
                  </div>
                </div>

                {/* Expand Button */}
                <button
                  onClick={() => handleExpand(pack.id)}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  {loadingPromptsId === pack.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : expandedId === pack.id ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Скрыть промпты
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Показать промпты ({pack.promptCount})
                    </>
                  )}
                </button>
              </div>

              {/* Expanded Prompts List */}
              {expandedId === pack.id && (
                <div className="border-t border-slate-200 bg-slate-50 p-4">
                  {loadingPromptsId === pack.id ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                    </div>
                  ) : pack.prompts && pack.prompts.length > 0 ? (
                    <div className="space-y-3">
                      {pack.prompts.map((prompt, idx) => (
                        <div
                          key={prompt.id}
                          className="bg-white rounded-lg border border-slate-200 p-3"
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-slate-800 text-sm">
                                {prompt.name}
                              </h4>
                              <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap break-words">
                                {prompt.promptText}
                              </p>
                              {prompt.negativePrompt && (
                                <p className="text-xs text-red-500 mt-1">
                                  <span className="font-medium">Negative:</span> {prompt.negativePrompt}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-slate-500 py-4">
                      Нет промптов в этом паке
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отклонить пак</DialogTitle>
            <DialogDescription>
              Укажите причину отклонения. Партнёр получит уведомление.
            </DialogDescription>
          </DialogHeader>

          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Укажите причину отклонения..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none min-h-[100px]"
            rows={4}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectModalOpen(false)}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processingId === rejectingPackId || !rejectionReason.trim()}
            >
              {processingId === rejectingPackId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Отклонить'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
