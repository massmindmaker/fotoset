'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Star,
  Edit2,
  Copy,
  Trash2,
  Package,
  MoreVertical,
  ImageIcon,
} from 'lucide-react'
import { SavedPrompt } from './PromptsContext'

interface PromptCardProps {
  prompt: SavedPrompt
  onEdit: () => void
  onDelete: () => void
  onAddToPack: () => void
  onToggleFavorite: () => void
  onCopy: () => void
  onGeneratePreview?: () => void
  isAddedToPack?: boolean
}

export function PromptCard({
  prompt,
  onEdit,
  onDelete,
  onAddToPack,
  onToggleFavorite,
  onCopy,
  onGeneratePreview,
  isAddedToPack,
}: PromptCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [imageError, setImageError] = useState(false)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Сегодня'
    if (diffDays === 1) return 'Вчера'
    if (diffDays < 7) return `${diffDays} дн. назад`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед. назад`
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="group relative bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-all">
      {/* Preview Image */}
      <div className="relative aspect-[4/3] bg-slate-100">
        {prompt.preview_url && !imageError ? (
          <Image
            src={prompt.preview_url}
            alt={prompt.name}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-slate-300" />
          </div>
        )}

        {/* Hover Actions Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2" role="group" aria-label="Действия с промптом">
          <button
            onClick={onEdit}
            className="p-2 rounded-lg bg-white/90 hover:bg-white text-slate-700 transition-colors"
            aria-label="Редактировать промпт"
          >
            <Edit2 className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={onCopy}
            className="p-2 rounded-lg bg-white/90 hover:bg-white text-slate-700 transition-colors"
            aria-label="Копировать промпт в буфер обмена"
          >
            <Copy className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={onAddToPack}
            className={`p-2 rounded-lg transition-colors ${
              isAddedToPack
                ? 'bg-green-500 text-white'
                : 'bg-white/90 hover:bg-white text-slate-700'
            }`}
            aria-label={isAddedToPack ? 'Добавлено в пак' : 'Добавить в пак'}
            aria-pressed={isAddedToPack}
          >
            <Package className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg bg-white/90 hover:bg-red-500 hover:text-white text-slate-700 transition-colors"
            aria-label="Удалить промпт"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Favorite Badge */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
          className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors ${
            prompt.is_favorite
              ? 'bg-yellow-500 text-white'
              : 'bg-white/80 text-slate-400 hover:text-yellow-500'
          }`}
          aria-label={prompt.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
          aria-pressed={prompt.is_favorite}
        >
          <Star className={`w-3.5 h-3.5 ${prompt.is_favorite ? 'fill-current' : ''}`} aria-hidden="true" />
        </button>

        {/* Generate Preview Button (if no preview) */}
        {!prompt.preview_url && onGeneratePreview && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onGeneratePreview()
            }}
            className="absolute bottom-2 right-2 px-2 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            aria-label="Создать превью для промпта"
          >
            Создать превью
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Name & Menu */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="font-medium text-slate-900 text-sm line-clamp-1">
            {prompt.name}
          </h4>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded hover:bg-slate-100 text-slate-400"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-slate-200 z-20 py-1">
                  <button
                    onClick={() => {
                      onEdit()
                      setShowMenu(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Редактировать
                  </button>
                  <button
                    onClick={() => {
                      onCopy()
                      setShowMenu(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Копировать
                  </button>
                  <button
                    onClick={() => {
                      onAddToPack()
                      setShowMenu(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Package className="w-4 h-4" />
                    В фотопак
                  </button>
                  <hr className="my-1 border-slate-200" />
                  <button
                    onClick={() => {
                      onDelete()
                      setShowMenu(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Удалить
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tags */}
        {prompt.tags && prompt.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {prompt.tags.slice(0, 3).map((tag, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded"
              >
                {tag}
              </span>
            ))}
            {prompt.tags.length > 3 && (
              <span className="px-1.5 py-0.5 text-xs text-slate-400">
                +{prompt.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Date */}
        <p className="text-xs text-slate-400">{formatDate(prompt.updated_at)}</p>
      </div>
    </div>
  )
}
