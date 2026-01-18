'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Package,
  ImageIcon,
  GripVertical,
  X,
} from 'lucide-react'
import { PhotoPack, PackItem } from './PromptsContext'

interface PackCardProps {
  pack: PhotoPack
  items: PackItem[]
  isExpanded: boolean
  isSelected: boolean
  isLoadingItems: boolean
  onToggleExpand: () => void
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onDeleteItem?: (itemId: number) => void
}

export function PackCard({
  pack,
  items,
  isExpanded,
  isSelected,
  isLoadingItems,
  onToggleExpand,
  onSelect,
  onEdit,
  onDelete,
  onDeleteItem,
}: PackCardProps) {
  const [imageError, setImageError] = useState(false)

  return (
    <div
      className={`
        rounded-xl border overflow-hidden transition-all
        ${isSelected
          ? 'bg-blue-50 border-blue-200 shadow-sm'
          : 'bg-white border-slate-200 hover:bg-slate-50'
        }
      `}
    >
      {/* Pack Header */}
      <div
        onClick={onSelect}
        className="p-3 cursor-pointer"
      >
        <div className="flex items-start gap-3">
          {/* Cover */}
          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
            {pack.cover_url && !imageError ? (
              <Image
                src={pack.cover_url}
                alt={pack.name}
                fill
                className="object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-5 h-5 text-slate-400" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-slate-900 text-sm truncate">
                {pack.name}
              </h4>
              <span
                className={`
                  px-1.5 py-0.5 text-xs rounded-full
                  ${pack.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-slate-100 text-slate-500'
                  }
                `}
              >
                {pack.is_active ? 'Активен' : 'Черновик'}
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <ImageIcon className="w-3 h-3" />
              {pack.items_count} {getItemsWord(pack.items_count)}
            </p>
          </div>

          {/* Expand/Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Редактировать"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              title="Удалить"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand()
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              title={isExpanded ? 'Свернуть' : 'Развернуть'}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Items */}
      {isExpanded && (
        <div className="border-t border-slate-200 bg-slate-50/50 p-3">
          {isLoadingItems ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-4">
              Пак пустой
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => (
                <PackItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  onDelete={onDeleteItem ? () => onDeleteItem(item.id) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Pack Item Row Component
function PackItemRow({
  item,
  index,
  onDelete,
}: {
  item: PackItem
  index: number
  onDelete?: () => void
}) {
  const [imageError, setImageError] = useState(false)

  return (
    <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
      {/* Drag Handle */}
      <div className="text-slate-300 cursor-grab">
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Position */}
      <span className="text-xs text-slate-400 w-5 text-center">
        {item.position || index + 1}
      </span>

      {/* Thumbnail */}
      <div className="relative w-10 h-10 rounded overflow-hidden bg-slate-100 flex-shrink-0">
        {item.photo_url && !imageError ? (
          <Image
            src={item.photo_url}
            alt={`Item ${index + 1}`}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-slate-300" />
          </div>
        )}
      </div>

      {/* Prompt Preview */}
      <p className="flex-1 text-xs text-slate-600 line-clamp-2">
        {item.prompt || 'Без промпта'}
      </p>

      {/* Delete */}
      {onDelete && (
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
          title="Удалить"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// Helper function for Russian pluralization
function getItemsWord(count: number): string {
  const lastTwo = count % 100
  const last = count % 10

  if (lastTwo >= 11 && lastTwo <= 14) return 'промптов'
  if (last === 1) return 'промпт'
  if (last >= 2 && last <= 4) return 'промпта'
  return 'промптов'
}
