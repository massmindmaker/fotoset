'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import {
  X,
  Package,
  Loader2,
  Search,
  Check,
  ImageIcon,
} from 'lucide-react'
import { usePromptsContext, PhotoPack } from './PromptsContext'

export function AddToPackPopover() {
  const { addToPackTarget, closeAddToPackPopover, refreshPacks } = usePromptsContext()

  const [packs, setPacks] = useState<PhotoPack[]>([])
  const [filteredPacks, setFilteredPacks] = useState<PhotoPack[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPackId, setSelectedPackId] = useState<number | null>(null)
  const [position, setPosition] = useState<number>(1)
  const [isAdding, setIsAdding] = useState(false)
  const [imageError, setImageError] = useState(false)

  const popoverRef = useRef<HTMLDivElement>(null)

  // Load packs when popover opens (with race condition protection)
  useEffect(() => {
    if (!addToPackTarget) return

    let cancelled = false
    const controller = new AbortController()

    // Reset states first
    setSearchQuery('')
    setSelectedPackId(null)
    setPosition(1)
    setImageError(false)

    // Load packs with abort support
    const loadPacksAsync = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/admin/packs?limit=100', {
          signal: controller.signal
        })
        if (cancelled) return
        if (response.ok) {
          const data = await response.json()
          setPacks(data.packs || [])
          setFilteredPacks(data.packs || [])
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('[AddToPackPopover] Failed to load packs:', error)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadPacksAsync()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [addToPackTarget])

  // Filter packs by search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPacks(packs)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredPacks(packs.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      ))
    }
  }, [searchQuery, packs])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAddToPackPopover()
      }
    }

    if (addToPackTarget) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [addToPackTarget, closeAddToPackPopover])

  const handleAddToPack = async () => {
    if (!selectedPackId || !addToPackTarget) return

    setIsAdding(true)
    try {
      const response = await fetch(`/api/admin/packs/${selectedPackId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_url: addToPackTarget.imageUrl,
          prompt: addToPackTarget.prompt || '',
          position: position,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add to pack')
      }

      // Refresh packs list to update counts
      refreshPacks()
      closeAddToPackPopover()
    } catch (error) {
      console.error('[AddToPackPopover] Add to pack error:', error)
      alert(error instanceof Error ? error.message : 'Ошибка добавления в пак')
    } finally {
      setIsAdding(false)
    }
  }

  if (!addToPackTarget) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={closeAddToPackPopover}
      />

      {/* Popover */}
      <div
        ref={popoverRef}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-900">Добавить в фотопак</h3>
          </div>
          <button
            onClick={closeAddToPackPopover}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
              {addToPackTarget.imageUrl && !imageError ? (
                <Image
                  src={addToPackTarget.imageUrl}
                  alt="Preview"
                  fill
                  className="object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-slate-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-600 line-clamp-2">
                {addToPackTarget.prompt || 'Изображение без промпта'}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск фотопака..."
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border border-transparent rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-500"
            />
          </div>
        </div>

        {/* Packs List */}
        <div className="max-h-[240px] overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : filteredPacks.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                {searchQuery ? 'Паки не найдены' : 'Нет доступных паков'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredPacks.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => setSelectedPackId(pack.id)}
                  className={`
                    w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left
                    ${selectedPackId === pack.id
                      ? 'bg-blue-50 border-blue-200 border'
                      : 'hover:bg-slate-50 border border-transparent'
                    }
                  `}
                >
                  {/* Pack Cover */}
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                    {pack.cover_url ? (
                      <Image
                        src={pack.cover_url}
                        alt={pack.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                  </div>

                  {/* Pack Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">
                      {pack.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {pack.items_count} элем.
                    </p>
                  </div>

                  {/* Selected Check */}
                  {selectedPackId === pack.id && (
                    <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Position Input */}
        {selectedPackId && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600">Позиция в паке:</label>
              <input
                type="number"
                value={position}
                onChange={(e) => setPosition(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                className="w-20 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 p-4 border-t border-slate-200">
          <button
            onClick={closeAddToPackPopover}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleAddToPack}
            disabled={!selectedPackId || isAdding}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isAdding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Добавление...
              </>
            ) : (
              <>
                <Package className="w-4 h-4" />
                Добавить
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
