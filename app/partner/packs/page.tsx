'use client'

import { useEffect } from 'react'
import { Loader2, Plus, Package, ChevronRight, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePartnerPacks } from '@/lib/partner-hooks'

export default function PartnerPacksPage() {
  const router = useRouter()
  const { packs, loading, error, refetch } = usePartnerPacks()

  // Redirect to login if auth error
  useEffect(() => {
    if (!loading && error) {
      // Check if it's an auth error (UNAUTHORIZED or FORBIDDEN)
      if (error.includes('UNAUTHORIZED') || error.includes('FORBIDDEN') || error.includes('Authentication')) {
        router.replace('/partner/login')
      }
    }
  }, [loading, error, router])

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-500/10 text-gray-500',
    pending: 'bg-yellow-500/10 text-yellow-600',
    approved: 'bg-green-500/10 text-green-600',
    rejected: 'bg-red-500/10 text-red-600'
  }

  const statusLabels: Record<string, string> = {
    draft: 'Черновик',
    pending: 'На модерации',
    approved: 'Одобрен',
    rejected: 'Отклонён'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium text-red-500">Ошибка загрузки</h2>
        <p className="text-muted-foreground mt-2">{error}</p>
        <button
          onClick={() => refetch()}
          className="inline-block mt-4 text-primary hover:underline"
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Мои паки</h1>
          <p className="text-muted-foreground">
            Создавайте и управляйте своими стилевыми паками
          </p>
        </div>

        <Link
          href="/partner/packs/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Создать пак
        </Link>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-4">
        <h3 className="font-medium mb-2">Как работают партнёрские паки</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>1. Создайте пак с 7-23 уникальными промптами</li>
          <li>2. Отправьте на модерацию — мы проверим качество</li>
          <li>3. После одобрения пользователи смогут выбрать ваш пак</li>
          <li>4. Получайте комиссию с каждой генерации</li>
        </ul>
      </div>

      {/* Packs Grid */}
      {packs.length === 0 ? (
        <div className="text-center py-12 bg-card border rounded-lg">
          <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Пока нет паков</h3>
          <p className="text-muted-foreground mt-1 mb-4">
            Создайте свой первый пак и начните зарабатывать
          </p>
          <Link
            href="/partner/packs/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Создать пак
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packs.map((pack) => (
            <Link
              key={pack.id}
              href={`/partner/packs/${pack.id}`}
              className="bg-card border rounded-lg overflow-hidden hover:border-primary transition-colors group"
            >
              {/* Preview Images */}
              <div className="aspect-video bg-muted relative">
                {pack.previewImages && pack.previewImages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-0.5 h-full">
                    {pack.previewImages.slice(0, 4).map((url, i) => (
                      <div key={i} className="relative overflow-hidden">
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Package className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${statusColors[pack.moderationStatus]}`}>
                    {statusLabels[pack.moderationStatus]}
                  </span>
                </div>

                {/* Active/Inactive */}
                {pack.moderationStatus === 'approved' && (
                  <div className="absolute top-2 left-2">
                    {pack.isActive ? (
                      <Eye className="w-4 h-4 text-green-500" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium truncate">{pack.name}</h3>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {pack.description || 'Нет описания'}
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span>{pack.promptCount} промптов</span>
                  <span>{pack.usageCount} использований</span>
                </div>
                
                {/* Rejection reason */}
                {pack.moderationStatus === 'rejected' && pack.rejectionReason && (
                  <div className="mt-2 p-2 bg-red-500/10 rounded text-xs text-red-600">
                    Причина: {pack.rejectionReason}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
