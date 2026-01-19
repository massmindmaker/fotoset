"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { ArrowLeft, Sparkles, Loader2, ImageIcon, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Pack data structure for style detail view
 */
export interface PackDetail {
  id: number
  slug: string
  name: string
  description: string | null
  emoji: string | null
  coverUrl: string | null
  isActive: boolean
  itemsCount: number
  usageCount?: number
  previewImages: string[]
}

export interface StyleDetailViewProps {
  packSlug: string
  onSelect: () => void
  onBack: () => void
  /** Optional cached pack data to avoid refetching */
  cachedPack?: PackDetail
}

/**
 * StyleDetailView - Display pack details with floating collage animation
 *
 * Features:
 * - Floating 2x2 masonry collage with staggered animation
 * - Pack name, description, emoji
 * - Stats: prompt count, usage count
 * - "Select this style" CTA button
 * - Back navigation
 */
export const StyleDetailView: React.FC<StyleDetailViewProps> = ({
  packSlug,
  onSelect,
  onBack,
  cachedPack,
}) => {
  const [pack, setPack] = useState<PackDetail | null>(cachedPack || null)
  const [isLoading, setIsLoading] = useState(!cachedPack)
  const [error, setError] = useState<string | null>(null)

  // Fetch pack details if not cached
  useEffect(() => {
    if (cachedPack) {
      setPack(cachedPack)
      return
    }

    const fetchPack = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/packs/${packSlug}`)
        if (!response.ok) {
          throw new Error("Failed to fetch pack details")
        }
        const data = await response.json()
        setPack(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setIsLoading(false)
      }
    }

    fetchPack()
  }, [packSlug, cachedPack])

  // Generate placeholder images if not enough preview images
  const collageImages = useMemo(() => {
    if (!pack) return []

    const images = pack.previewImages || []
    // Ensure we have 4 images for the collage
    while (images.length < 4) {
      images.push("")
    }
    return images.slice(0, 4)
  }, [pack])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading pack details...</p>
      </div>
    )
  }

  if (error || !pack) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-destructive">{error || "Pack not found"}</p>
        <Button variant="outline" onClick={onBack}>
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-32 sm:pb-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-11 h-11 flex items-center justify-center hover:bg-muted active:bg-muted/80 rounded-xl text-muted-foreground hover:text-foreground transition-colors active:scale-95 touch-manipulation"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {pack.emoji && (
              <span className="text-2xl" role="img" aria-hidden="true">
                {pack.emoji}
              </span>
            )}
            <h1 className="text-xl font-semibold text-foreground">
              {pack.name}
            </h1>
          </div>
        </div>
      </div>

      {/* Floating 2x2 Collage */}
      <div className="relative mx-auto max-w-md px-4">
        <div className="masonry-collage grid grid-cols-2 gap-3">
          {collageImages.map((imageUrl, index) => (
            <CollageItem
              key={index}
              imageUrl={imageUrl}
              index={index}
              packName={pack.name}
            />
          ))}
        </div>
      </div>

      {/* Pack Description */}
      <div className="space-y-4 px-1">
        {pack.description && (
          <p className="text-muted-foreground text-center leading-relaxed">
            {pack.description}
          </p>
        )}

        {/* Stats Row */}
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ImageIcon className="w-4 h-4" />
            <span>
              <strong className="text-foreground">{pack.itemsCount}</strong>{" "}
              {getPromptsWord(pack.itemsCount)}
            </span>
          </div>

          {pack.usageCount !== undefined && pack.usageCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>
                <strong className="text-foreground">{pack.usageCount}</strong>{" "}
                {getUsageWord(pack.usageCount)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 glass-strong border-t border-border sm:relative sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 safe-area-inset-bottom">
        <Button
          onClick={onSelect}
          className="w-full sm:w-auto btn-premium flex items-center justify-center gap-2"
          size="lg"
        >
          <Sparkles className="w-4 h-4" />
          Select this style
        </Button>
      </div>
    </div>
  )
}

/**
 * Individual collage item with floating animation
 */
interface CollageItemProps {
  imageUrl: string
  index: number
  packName: string
}

const CollageItem: React.FC<CollageItemProps> = ({ imageUrl, index, packName }) => {
  const [hasError, setHasError] = useState(false)

  // Masonry aspect ratios: alternating pattern for visual interest
  const aspectRatios = [
    "aspect-[1.2/1]",  // Image 1: wider (landscape-ish)
    "aspect-[1/1.2]",  // Image 2: taller (portrait-ish)
    "aspect-[1/1.2]",  // Image 3: taller (portrait-ish)
    "aspect-[1.2/1]",  // Image 4: wider (landscape-ish)
  ]

  // Animation delays for staggered float effect
  const animationDelays = ["0s", "0.5s", "1s", "1.5s"]

  return (
    <div
      className={cn(
        "collage-item relative overflow-hidden rounded-2xl bg-muted",
        aspectRatios[index],
      )}
      style={{
        animationDelay: animationDelays[index],
      }}
    >
      {imageUrl && !hasError ? (
        <img
          src={imageUrl}
          alt={`${packName} preview ${index + 1}`}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
          <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
        </div>
      )}

      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
    </div>
  )
}

/**
 * Russian pluralization for "prompts"
 */
function getPromptsWord(count: number): string {
  const lastTwo = count % 100
  const last = count % 10

  if (lastTwo >= 11 && lastTwo <= 14) return "prompts"
  if (last === 1) return "prompt"
  if (last >= 2 && last <= 4) return "prompts"
  return "prompts"
}

/**
 * Russian pluralization for "usage"
 */
function getUsageWord(count: number): string {
  const lastTwo = count % 100
  const last = count % 10

  if (lastTwo >= 11 && lastTwo <= 14) return "uses"
  if (last === 1) return "use"
  if (last >= 2 && last <= 4) return "uses"
  return "uses"
}

export default StyleDetailView
