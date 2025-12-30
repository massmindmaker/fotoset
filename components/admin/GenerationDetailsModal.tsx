'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Image,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RotateCcw,
  User,
  Calendar,
  Timer,
  Zap,
  Download,
  ExternalLink
} from 'lucide-react'
import type { GenerationDetails, GenerationStatus } from '@/lib/admin/types'

interface GenerationDetailsModalProps {
  jobId: number | null
  isOpen: boolean
  onClose: () => void
  onRetry?: () => void
}

export function GenerationDetailsModal({ jobId, isOpen, onClose, onRetry }: GenerationDetailsModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<GenerationDetails | null>(null)
  const [activeTab, setActiveTab] = useState<'photos' | 'tasks' | 'info'>('photos')

  useEffect(() => {
    if (isOpen && jobId) {
      fetchJobDetails()
    }
  }, [isOpen, jobId])

  const fetchJobDetails = async () => {
    if (!jobId) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/admin/generations/${jobId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch job details')
      }

      const data = await response.json()
      setJob(data.job)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '—'
    if (seconds < 60) return `${seconds} сек`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins} мин ${secs} сек`
  }

  const getStatusBadge = (status: GenerationStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Завершено
          </span>
        )
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            В процессе
          </span>
        )
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium">
            <Clock className="w-4 h-4" />
            В очереди
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-sm font-medium">
            <XCircle className="w-4 h-4" />
            Ошибка
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-500/20 text-zinc-400 text-sm font-medium">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden border border-zinc-700/50">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
              <Zap className="w-5 h-5 text-pink-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Генерация #{jobId}
              </h2>
              {job && (
                <p className="text-sm text-zinc-500">
                  {job.avatar_name || `Avatar #${job.avatar_id}`} • {job.style_id || 'N/A'}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-red-400">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          ) : job ? (
            <div className="space-y-6">
              {/* Status & Progress */}
              <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-xl">
                <div className="flex items-center gap-4">
                  {getStatusBadge(job.status)}
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          job.status === 'completed' ? 'bg-emerald-500' :
                          job.status === 'failed' ? 'bg-red-500' :
                          'bg-blue-500'
                        }`}
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <span className="text-sm text-zinc-400">
                      {job.completed_photos}/{job.total_photos} фото
                    </span>
                  </div>
                </div>
                {(job.status === 'failed' || job.status === 'cancelled') && onRetry && (
                  <button
                    onClick={onRetry}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg text-amber-400 font-medium transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Повторить
                  </button>
                )}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-zinc-800/50 rounded-xl">
                  <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
                    <User className="w-3 h-3" />
                    Пользователь
                  </div>
                  <p className="text-white font-mono text-sm">{job.telegram_user_id}</p>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-xl">
                  <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
                    <Calendar className="w-3 h-3" />
                    Создано
                  </div>
                  <p className="text-white text-sm">{formatDate(job.created_at)}</p>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-xl">
                  <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
                    <Timer className="w-3 h-3" />
                    Время
                  </div>
                  <p className="text-white text-sm">{formatDuration(job.duration)}</p>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-xl">
                  <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
                    <Image className="w-3 h-3" />
                    Референсы
                  </div>
                  <p className="text-white text-sm">{job.avatar?.reference_photos_count || 0} фото</p>
                </div>
              </div>

              {/* Error Message */}
              {job.error_message && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <p className="text-sm font-medium text-red-400">Ошибка</p>
                  </div>
                  <p className="text-sm text-red-400/80 font-mono">{job.error_message}</p>
                </div>
              )}

              {/* Tabs */}
              <div className="border-b border-zinc-700/50">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('photos')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'photos'
                        ? 'border-pink-500 text-white'
                        : 'border-transparent text-zinc-400 hover:text-white'
                    }`}
                  >
                    Фото ({job.photos.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('tasks')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'tasks'
                        ? 'border-pink-500 text-white'
                        : 'border-transparent text-zinc-400 hover:text-white'
                    }`}
                  >
                    Задачи ({job.kie_tasks.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('info')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'info'
                        ? 'border-pink-500 text-white'
                        : 'border-transparent text-zinc-400 hover:text-white'
                    }`}
                  >
                    Детали
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === 'photos' && (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {job.photos.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-zinc-500">
                      <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      Фото ещё не сгенерированы
                    </div>
                  ) : (
                    job.photos.map(photo => (
                      <div
                        key={photo.id}
                        className="relative aspect-square rounded-lg overflow-hidden bg-zinc-800 group"
                      >
                        <img
                          src={photo.image_url}
                          alt={`Generated photo ${photo.id}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <a
                            href={photo.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <a
                            href={photo.image_url}
                            download={`photo-${photo.id}.jpg`}
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                        {photo.style_id && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                            <p className="text-xs text-white/80 truncate">{photo.style_id}</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'tasks' && (
                <div className="space-y-2">
                  {job.kie_tasks.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">
                      <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      Нет задач KIE
                    </div>
                  ) : (
                    job.kie_tasks.map(task => (
                      <div
                        key={task.id}
                        className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-lg"
                      >
                        <div className={`w-2 h-2 rounded-full ${
                          task.status === 'completed' ? 'bg-emerald-500' :
                          task.status === 'failed' ? 'bg-red-500' :
                          task.status === 'processing' ? 'bg-blue-500 animate-pulse' :
                          'bg-zinc-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">
                            {task.style_id || `Task #${task.id}`}
                          </p>
                          <p className="text-xs text-zinc-500 font-mono truncate">
                            {task.task_id || 'No task ID'}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                          task.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          task.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-zinc-500/20 text-zinc-400'
                        }`}>
                          {task.status}
                        </span>
                        {task.error_message && (
                          <span className="text-xs text-red-400 truncate max-w-[200px]" title={task.error_message}>
                            {task.error_message}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'info' && (
                <div className="space-y-4">
                  <div className="p-4 bg-zinc-800/50 rounded-xl">
                    <h4 className="text-sm font-medium text-white mb-3">Аватар</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-zinc-500">ID</p>
                        <p className="text-white">{job.avatar_id}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Название</p>
                        <p className="text-white">{job.avatar?.name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Статус</p>
                        <p className="text-white">{job.avatar?.status || '—'}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Референсов</p>
                        <p className="text-white">{job.avatar?.reference_photos_count || 0}</p>
                      </div>
                    </div>
                  </div>

                  {job.payment_id && (
                    <div className="p-4 bg-zinc-800/50 rounded-xl">
                      <h4 className="text-sm font-medium text-white mb-3">Платёж</h4>
                      <p className="text-sm text-zinc-400">
                        Payment ID: <span className="text-white font-mono">{job.payment_id}</span>
                      </p>
                    </div>
                  )}

                  <div className="p-4 bg-zinc-800/50 rounded-xl">
                    <h4 className="text-sm font-medium text-white mb-3">Временные метки</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-zinc-500">Создано</p>
                        <p className="text-white">{formatDate(job.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Обновлено</p>
                        <p className="text-white">{formatDate(job.updated_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
