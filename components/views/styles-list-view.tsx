"use client"

import type React from "react"
import { useCallback } from "react"
import { RefreshCw, AlertCircle, Star, Users } from "lucide-react"
import Image from "next/image"
import { usePacks, type Pack } from "@/hooks/use-packs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface StylesListViewProps {
  onPackSelect: (packSlug: string) => void
}

/**
 * View for displaying available style packs in a grid
 * Features: 2x2 collage preview, badges, pull-to-refresh, loading/error states
 */
export const StylesListView: React.FC<StylesListViewProps> = ({ onPackSelect }) => {
  const { packs, isLoading, error, refetch } = usePacks()

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  // Error state
  if (error && !isLoading) {
    return (
      <div className="space-y-6 view-transition-name-main">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Стили</h1>
          <p className="text-muted-foreground text-sm mt-1">Выберите стиль для генерации</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Не удалось загрузить</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs">
            {error.message || "Произошла ошибка при загрузке стилей"}
          </p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 active:bg-primary/80 transition-colors touch-manipulation"
          >
            <RefreshCw className="w-4 h-4" />
            Повторить
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 view-transition-name-main">
      {/* Header with pull-to-refresh button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Стили</h1>
          <p className="text-muted-foreground text-sm mt-1">Выберите стиль для генерации</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className={cn(
            "p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all touch-manipulation",
            isLoading && "animate-spin"
          )}
          aria-label="Обновить список"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Pack grid */}
      {isLoading ? (
        <PackGridSkeleton />
      ) : packs.length === 0 ? (
        <EmptyState onRefresh={handleRefresh} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {packs.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              onSelect={() => onPackSelect(pack.slug)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Individual pack card component with 2x2 collage preview
 */
interface PackCardProps {
  pack: Pack
  onSelect: () => void
}

function PackCard({ pack, onSelect }: PackCardProps) {
  // Get up to 4 preview images for collage
  const previewImages = pack.preview_urls.slice(0, 4)

  return (
    <button
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl bg-card border border-border",
        "transition-all duration-300 ease-out touch-manipulation",
        "hover:shadow-[var(--shadow-lg)] hover:border-primary/30",
        "active:scale-[0.98] active:shadow-[var(--shadow-md)]",
        "hover:-translate-y-0.5",
        "shadow-[var(--shadow-sm)]"
      )}
    >
      {/* 2x2 Collage Preview */}
      <div className="relative aspect-square overflow-hidden">
        <CollagePreview images={previewImages} coverUrl={pack.cover_url} />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
          {pack.is_featured && (
            <Badge
              variant="default"
              className="text-[10px] px-1.5 py-0.5 bg-amber-500/90 text-white border-0 shadow-md"
            >
              <Star className="w-2.5 h-2.5 mr-0.5 fill-current" />
              Featured
            </Badge>
          )}
          {pack.owner_type === "partner" && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0.5 bg-[var(--accent-purple)]/90 text-white border-0 shadow-md"
            >
              <Users className="w-2.5 h-2.5 mr-0.5" />
              Partner
            </Badge>
          )}
        </div>
      </div>

      {/* Card content */}
      <div className="p-3 text-left">
        <div className="flex items-center gap-1.5 mb-1">
          {pack.icon && (
            <span className="text-base" role="img" aria-hidden>
              {pack.icon}
            </span>
          )}
          <h3 className="font-semibold text-sm text-foreground truncate">
            {pack.name}
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {pack.styles_count} {getStylesWord(pack.styles_count)} &bull; {pack.generations_count} {getGenerationsWord(pack.generations_count)}
        </p>
      </div>
    </button>
  )
}

/**
 * 2x2 collage preview component
 */
interface CollagePreviewProps {
  images: string[]
  coverUrl: string | null
}

function CollagePreview({ images, coverUrl }: CollagePreviewProps) {
  // If we have 4 images, show 2x2 grid
  if (images.length >= 4) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
        {images.slice(0, 4).map((url, index) => (
          <div key={index} className="relative overflow-hidden">
            <Image
              src={url}
              alt=""
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              sizes="(max-width: 640px) 25vw, (max-width: 768px) 16vw, 12vw"
            />
          </div>
        ))}
      </div>
    )
  }

  // Fallback to cover image or placeholder
  const displayUrl = images[0] || coverUrl

  if (displayUrl) {
    return (
      <Image
        src={displayUrl}
        alt=""
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-110"
        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
      />
    )
  }

  // Placeholder when no images
  return (
    <div className="w-full h-full bg-muted flex items-center justify-center">
      <div className="text-4xl opacity-30">
        {images.length === 0 ? "?" : ""}
      </div>
    </div>
  )
}

/**
 * Loading skeleton for pack grid
 */
function PackGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col overflow-hidden rounded-2xl bg-card border border-border">
          <Skeleton className="aspect-square w-full" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Empty state when no packs available
 */
interface EmptyStateProps {
  onRefresh: () => void
}

function EmptyState({ onRefresh }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <span className="text-3xl">?</span>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">Стили не найдены</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">
        Пока нет доступных стилей для генерации
      </p>
      <button
        onClick={onRefresh}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 active:bg-primary/80 transition-colors touch-manipulation"
      >
        <RefreshCw className="w-4 h-4" />
        Обновить
      </button>
    </div>
  )
}

// Russian pluralization helpers
function getStylesWord(count: number): string {
  const lastTwo = count % 100
  const last = count % 10

  if (lastTwo >= 11 && lastTwo <= 14) return "стилей"
  if (last === 1) return "стиль"
  if (last >= 2 && last <= 4) return "стиля"
  return "стилей"
}

function getGenerationsWord(count: number): string {
  const lastTwo = count % 100
  const last = count % 10

  if (lastTwo >= 11 && lastTwo <= 14) return "генераций"
  if (last === 1) return "генерация"
  if (last >= 2 && last <= 4) return "генерации"
  return "генераций"
}

export default StylesListView
