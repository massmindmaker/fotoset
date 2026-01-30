"use client"

import { useState } from "react"
import {
  Plus,
  Edit2,
  Trash2,
  GripVertical,
  X,
  Save,
  Loader2,
  Image as ImageIcon,
} from "lucide-react"

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

interface PartnerPromptsListProps {
  prompts: Prompt[]
  packId: number
  canEdit: boolean
  onRefresh: () => void
}

/**
 * PartnerPromptsList Component
 *
 * Displays list of prompts in a partner's pack
 * Features:
 * - Preview image thumbnails
 * - Edit/Delete actions
 * - Add new prompt manually
 * - Drag-n-drop reorder (future)
 */
export function PartnerPromptsList({
  prompts,
  packId,
  canEdit,
  onRefresh,
}: PartnerPromptsListProps) {
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    prompt: "",
    negativePrompt: "",
    stylePrefix: "",
    styleSuffix: "",
    previewUrl: "",
  })

  const openCreateModal = () => {
    setEditingPrompt(null)
    setFormData({
      prompt: "",
      negativePrompt: "",
      stylePrefix: "",
      styleSuffix: "",
      previewUrl: "",
    })
    setIsModalOpen(true)
  }

  const openEditModal = (prompt: Prompt) => {
    setEditingPrompt(prompt)
    setFormData({
      prompt: prompt.prompt,
      negativePrompt: prompt.negativePrompt || "",
      stylePrefix: prompt.stylePrefix || "",
      styleSuffix: prompt.styleSuffix || "",
      previewUrl: prompt.previewUrl || "",
    })
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.prompt.trim()) {
      alert("Промпт обязателен")
      return
    }

    setSaving(true)
    try {
      const url = editingPrompt
        ? `/api/partner/packs/${packId}/prompts/${editingPrompt.id}`
        : `/api/partner/packs/${packId}/prompts`

      const res = await fetch(url, {
        method: editingPrompt ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt: formData.prompt.trim(),
          negativePrompt: formData.negativePrompt.trim() || null,
          stylePrefix: formData.stylePrefix.trim() || null,
          styleSuffix: formData.styleSuffix.trim() || null,
          previewUrl: formData.previewUrl.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Ошибка сохранения")
      }

      setIsModalOpen(false)
      onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка сохранения")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (promptId: number) => {
    if (!confirm("Удалить этот промпт?")) return

    try {
      const res = await fetch(`/api/partner/packs/${packId}/prompts/${promptId}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Ошибка удаления")
      }

      onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка удаления")
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-slate-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Промпты пака ({prompts.length}/23)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Минимум 7 для модерации
            </p>
          </div>
          {canEdit && prompts.length < 23 && (
            <button
              onClick={openCreateModal}
              className="p-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              title="Добавить вручную"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-slate-100 bg-slate-50">
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              prompts.length < 7
                ? "bg-amber-500"
                : prompts.length <= 23
                ? "bg-green-500"
                : "bg-red-500"
            }`}
            style={{ width: `${Math.min((prompts.length / 23) * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>0</span>
          <span className={prompts.length >= 7 ? "text-green-500 font-medium" : ""}>
            7 мин
          </span>
          <span>23</span>
        </div>
      </div>

      {/* Prompts list */}
      <div className="flex-1 overflow-y-auto p-4">
        {prompts.length === 0 ? (
          <div className="text-center py-8">
            <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500 mb-3">Пока нет промптов</p>
            <p className="text-xs text-slate-400">
              Используйте тестер слева для генерации и добавления промптов
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {prompts.map((prompt, index) => (
              <div
                key={prompt.id}
                className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg group hover:bg-slate-100 transition-colors"
              >
                {/* Drag handle + index */}
                <div className="flex items-center gap-2 text-slate-400 shrink-0">
                  <GripVertical className="w-4 h-4 opacity-0 group-hover:opacity-50 cursor-grab" />
                  <span className="w-5 text-center text-xs font-medium">
                    {index + 1}
                  </span>
                </div>

                {/* Preview thumbnail */}
                <div className="w-12 h-16 bg-slate-200 rounded overflow-hidden shrink-0">
                  {prompt.previewUrl ? (
                    <img
                      src={prompt.previewUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                </div>

                {/* Prompt text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 line-clamp-2">
                    {prompt.prompt}
                  </p>
                  {prompt.negativePrompt && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                      Negative: {prompt.negativePrompt}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditModal(prompt)}
                      className="p-1.5 hover:bg-white rounded transition-colors"
                      title="Редактировать"
                    >
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(prompt.id)}
                      className="p-1.5 hover:bg-red-50 text-red-500 rounded transition-colors"
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

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto m-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingPrompt ? "Редактировать промпт" : "Новый промпт"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Промпт *
                </label>
                <textarea
                  value={formData.prompt}
                  onChange={(e) =>
                    setFormData({ ...formData, prompt: e.target.value })
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  placeholder="Основной промпт для генерации..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Негативный промпт
                </label>
                <textarea
                  value={formData.negativePrompt}
                  onChange={(e) =>
                    setFormData({ ...formData, negativePrompt: e.target.value })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  placeholder="Что исключить из генерации..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Префикс стиля
                  </label>
                  <input
                    type="text"
                    value={formData.stylePrefix}
                    onChange={(e) =>
                      setFormData({ ...formData, stylePrefix: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="professional photo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Суффикс стиля
                  </label>
                  <input
                    type="text"
                    value={formData.styleSuffix}
                    onChange={(e) =>
                      setFormData({ ...formData, styleSuffix: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="8k, detailed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  URL превью
                </label>
                <input
                  type="text"
                  value={formData.previewUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, previewUrl: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="https://..."
                />
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
                disabled={saving || !formData.prompt.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
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
        </div>
      )}
    </div>
  )
}
