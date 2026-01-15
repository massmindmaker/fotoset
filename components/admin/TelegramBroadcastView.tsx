"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Send,
  Users,
  CreditCard,
  Activity,
  UserCheck,
  Image as ImageIcon,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  History,
  Bold,
  Italic,
  Code,
  Link as LinkIcon,
  Strikethrough,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Crown,
  Upload,
  X
} from "lucide-react"

interface Broadcast {
  id: number
  message: string
  photo_url: string | null
  target_type: string
  target_count: number
  queued_count: number
  sent_count: number
  failed_count: number
  status: string
  created_at: string
  completed_at: string | null
}

type TargetType = 'all' | 'paid' | 'active' | 'partners' | 'specific'

const TARGET_OPTIONS: { value: TargetType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'all',
    label: 'Все пользователи',
    description: 'Все зарегистрированные пользователи с Telegram',
    icon: <Users className="w-5 h-5" />
  },
  {
    value: 'paid',
    label: 'Оплатившие',
    description: 'Пользователи с успешными платежами',
    icon: <CreditCard className="w-5 h-5" />
  },
  {
    value: 'active',
    label: 'Активные (30 дней)',
    description: 'Пользователи активные за последние 30 дней',
    icon: <Activity className="w-5 h-5" />
  },
  {
    value: 'partners',
    label: 'Партнёры',
    description: 'Только партнёры реферальной программы',
    icon: <Crown className="w-5 h-5" />
  },
  {
    value: 'specific',
    label: 'Конкретные пользователи',
    description: 'Укажите Telegram ID через запятую',
    icon: <UserCheck className="w-5 h-5" />
  }
]

/**
 * TelegramBroadcastView - Admin component for mass messaging
 */
export function TelegramBroadcastView() {
  // Message state
  const [message, setMessage] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [target, setTarget] = useState<TargetType>('all')
  const [specificIds, setSpecificIds] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // UI state
  const [loading, setLoading] = useState(false)
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // History state
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(true)

  // Load broadcast history
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/telegram/broadcast?limit=10')
      if (res.ok) {
        const data = await res.json()
        setBroadcasts(data.broadcasts || [])
      }
    } catch (err) {
      console.error('Failed to load broadcast history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Handle file upload to R2
  const uploadPhoto = async (file: File): Promise<string | null> => {
    setUploadingPhoto(true)
    try {
      // Create form data
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'broadcasts')

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        throw new Error('Upload failed')
      }

      const data = await res.json()
      return data.url
    } catch (err) {
      console.error('Photo upload error:', err)
      setError('Не удалось загрузить фото')
      return null
    } finally {
      setUploadingPhoto(false)
    }
  }

  // Handle file selection (drag-drop or click)
  const handleFileSelect = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, выберите изображение')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Размер файла не должен превышать 5MB')
      return
    }

    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setError(null)

    // Upload to R2
    const uploadedUrl = await uploadPhoto(file)
    if (uploadedUrl) {
      setPhotoUrl(uploadedUrl)
    }
  }

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  // Remove photo
  const removePhoto = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoUrl('')
  }

  // Preview target count
  const handlePreview = async () => {
    setPreviewLoading(true)
    setError(null)

    try {
      const userIds = target === 'specific'
        ? specificIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
        : []

      const res = await fetch('/api/admin/telegram/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message || 'Preview',
          target,
          userIds,
          preview: true
        })
      })

      const data = await res.json()
      if (data.success) {
        setPreviewCount(data.targetCount)
      } else {
        setError(data.error || 'Failed to get preview')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setPreviewLoading(false)
    }
  }

  // Send broadcast
  const handleSend = async () => {
    if (!message.trim()) {
      setError('Введите сообщение')
      return
    }

    if (target === 'specific' && !specificIds.trim()) {
      setError('Укажите Telegram ID пользователей')
      return
    }

    // Confirm before sending
    const confirmMessage = `Отправить сообщение ${previewCount || '?'} пользователям?`
    if (!confirm(confirmMessage)) {
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const userIds = target === 'specific'
        ? specificIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
        : []

      const res = await fetch('/api/admin/telegram/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          photoUrl: photoUrl || undefined,
          target,
          userIds
        })
      })

      const data = await res.json()
      if (data.success) {
        setSuccess(`Рассылка создана! ID: ${data.broadcastId}, сообщений в очереди: ${data.queuedCount}`)
        setMessage('')
        removePhoto() // Clear photo state
        setPreviewCount(null)
        loadHistory()
      } else {
        setError(data.error || 'Failed to create broadcast')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  // Insert formatting tag
  const insertTag = (tag: string, closeTag?: string) => {
    const textarea = document.getElementById('broadcast-message') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = message.substring(start, end)
    const newText = message.substring(0, start) +
      `<${tag}>` + selectedText + `</${closeTag || tag}>` +
      message.substring(end)

    setMessage(newText)

    // Restore cursor position
    setTimeout(() => {
      textarea.focus()
      const newPos = start + tag.length + 2 + selectedText.length
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">Завершено</span>
      case 'sending':
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">Отправка</span>
      case 'failed':
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">Ошибка</span>
      default:
        return <span className="px-2 py-1 bg-zinc-500/20 text-zinc-400 text-xs rounded-full">{status}</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Message Editor */}
      <div className="bg-card/50 border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Send className="w-5 h-5 text-primary" />
          Новая рассылка
        </h3>

        {/* Target Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Получатели
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TARGET_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => {
                  setTarget(option.value)
                  setPreviewCount(null)
                }}
                className={`p-4 rounded-xl border text-left transition-all ${
                  target === option.value
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card/50 text-muted-foreground hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {option.icon}
                  <span className="font-medium">{option.label}</span>
                </div>
                <p className="text-xs opacity-70">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Specific IDs input */}
        {target === 'specific' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Telegram ID (через запятую)
            </label>
            <input
              type="text"
              value={specificIds}
              onChange={(e) => setSpecificIds(e.target.value)}
              placeholder="123456789, 987654321, ..."
              className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        {/* Photo Upload (Drag & Drop) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            <ImageIcon className="w-4 h-4 inline mr-1" />
            Фото (опционально)
          </label>

          {photoPreview ? (
            // Photo preview with remove button
            <div className="relative inline-block">
              <img
                src={photoPreview}
                alt="Preview"
                className="max-h-48 rounded-xl border border-border"
              />
              <button
                onClick={removePhoto}
                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                title="Удалить фото"
              >
                <X className="w-4 h-4" />
              </button>
              {uploadingPhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                  <Loader2 className="w-8 h-8 animate-spin text-white" />
                </div>
              )}
              {photoUrl && !uploadingPhoto && (
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-500/80 text-white text-xs rounded-lg flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Загружено
                </div>
              )}
            </div>
          ) : (
            // Drag & drop zone
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                transition-all duration-200
                ${isDragging
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }
              `}
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelect(file)
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="text-sm text-muted-foreground">
                {isDragging ? (
                  <span className="text-primary font-medium">Отпустите для загрузки</span>
                ) : (
                  <>
                    <span className="font-medium">Перетащите фото сюда</span>
                    <br />
                    <span className="text-xs">или нажмите для выбора (до 5MB)</span>
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Message Editor */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Сообщение (HTML форматирование)
          </label>

          {/* Formatting toolbar */}
          <div className="flex items-center gap-1 mb-2 p-2 bg-muted/30 rounded-t-xl border border-border border-b-0">
            <button
              onClick={() => insertTag('b')}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Жирный"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertTag('i')}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Курсив"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertTag('s')}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Зачёркнутый"
            >
              <Strikethrough className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertTag('code')}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Код"
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const url = prompt('Введите URL:')
                if (url) {
                  const textarea = document.getElementById('broadcast-message') as HTMLTextAreaElement
                  if (textarea) {
                    const start = textarea.selectionStart
                    const end = textarea.selectionEnd
                    const selectedText = message.substring(start, end) || 'ссылка'
                    const newText = message.substring(0, start) +
                      `<a href="${url}">${selectedText}</a>` +
                      message.substring(end)
                    setMessage(newText)
                  }
                }
              }}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Ссылка"
            >
              <LinkIcon className="w-4 h-4" />
            </button>

            <div className="flex-1" />

            <span className="text-xs text-muted-foreground">
              {message.length} символов
            </span>
          </div>

          <textarea
            id="broadcast-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Введите текст сообщения...

Поддерживается HTML:
<b>жирный</b>
<i>курсив</i>
<a href='url'>ссылка</a>
<code>код</code>"
            rows={8}
            className="w-full px-4 py-3 bg-card border border-border rounded-b-xl focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
          />
        </div>

        {/* Preview & Send */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={handlePreview}
            disabled={previewLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-muted hover:bg-muted/80 rounded-xl transition-colors disabled:opacity-50"
          >
            {previewLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            Проверить получателей
          </button>

          {previewCount !== null && (
            <div className="flex items-center gap-2 px-4 py-3 bg-primary/10 border border-primary/30 rounded-xl">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-medium">{previewCount.toLocaleString()}</span>
              <span className="text-muted-foreground">получателей</span>
            </div>
          )}

          <div className="flex-1" />

          <button
            onClick={handleSend}
            disabled={loading || !message.trim()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl transition-colors disabled:opacity-50 font-medium"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Отправить рассылку
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span className="text-green-400">{success}</span>
          </div>
        )}
      </div>

      {/* Broadcast History */}
      <div className="bg-card/50 border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            <span className="font-semibold">История рассылок</span>
            <span className="text-sm text-muted-foreground">({broadcasts.length})</span>
          </div>
          {showHistory ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {showHistory && (
          <div className="border-t border-border">
            {historyLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : broadcasts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Рассылок пока нет</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {broadcasts.map(broadcast => (
                  <div key={broadcast.id} className="p-4 hover:bg-muted/20">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusBadge(broadcast.status)}
                          <span className="text-xs text-muted-foreground">
                            {new Date(broadcast.created_at).toLocaleString('ru-RU')}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-2 text-foreground/80">
                          {broadcast.message.replace(/<[^>]*>/g, '').substring(0, 150)}
                          {broadcast.message.length > 150 && '...'}
                        </p>
                        {broadcast.photo_url && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <ImageIcon className="w-3 h-3" />
                            С фото
                          </span>
                        )}
                      </div>

                      <div className="text-right text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="w-3 h-3" />
                          <span>{broadcast.target_count}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-green-400">{broadcast.sent_count} ✓</span>
                          {broadcast.failed_count > 0 && (
                            <span className="text-red-400">{broadcast.failed_count} ✗</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
