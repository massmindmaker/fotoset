'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save, Package } from 'lucide-react'

export default function NewPackPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    iconEmoji: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError('Название пака обязательно')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/partner/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          iconEmoji: formData.iconEmoji.trim() || null
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to create pack')
      }

      // Redirect to pack edit page
      router.push(`/partner/packs/${data.pack.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/partner/packs"
          className="p-2 hover:bg-accent rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Новый пак</h1>
          <p className="text-muted-foreground">
            Создайте свой стилевой пак
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card border rounded-lg p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Название пака *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Например: Бизнес-портреты"
              className="w-full px-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Краткое и понятное название для вашего пака
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Описание
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Опишите стиль и особенности вашего пака..."
              rows={3}
              className="w-full px-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
              maxLength={500}
            />
          </div>

          {/* Icon Emoji */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Иконка (emoji)
            </label>
            <input
              type="text"
              value={formData.iconEmoji}
              onChange={(e) => setFormData({ ...formData, iconEmoji: e.target.value })}
              placeholder=""
              className="w-20 px-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-center text-2xl"
              maxLength={2}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Необязательно. По умолчанию будет использоваться стандартная иконка
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex gap-3">
            <Package className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-700 dark:text-blue-400">После создания</p>
              <p className="text-muted-foreground mt-1">
                Вам нужно будет добавить от 7 до 23 промптов в пак, 
                после чего можно отправить его на модерацию.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/partner/packs"
            className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            Отмена
          </Link>
          <button
            type="submit"
            disabled={loading || !formData.name.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Создать пак
          </button>
        </div>
      </form>
    </div>
  )
}
