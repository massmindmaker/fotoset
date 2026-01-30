"use client"

import type React from "react"
import { useCallback, useRef } from "react"
import { ArrowLeft, Sparkles, CheckCircle2, Loader2, Star, Percent, Palette } from "lucide-react"
import type { Persona, PricingTier } from "./types"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useActivePack } from "@/components/hooks/useActivePack"
import { useFeatureFlags } from "@/components/hooks/useFeatureFlags"

export interface TierSelectViewProps {
  persona: Persona
  onBack: () => void
  onGenerate: (tier: PricingTier) => void
  isGenerating: boolean
  isProcessingPayment?: boolean  // Show loader immediately after button click
  onUpgrade: (tier: PricingTier) => void
  selectedTier: PricingTier
  onSelectTier: (tier: PricingTier) => void
  pricingTiers: PricingTier[]  // Dynamic pricing from usePricing hook
  telegramUserId?: number  // For fetching active pack
  neonUserId?: string  // For web users
  onChangeStyle?: () => void  // Callback to change selected style
}

export const TierSelectView: React.FC<TierSelectViewProps> = ({
  onBack,
  onGenerate,
  isGenerating,
  isProcessingPayment,
  onUpgrade,
  selectedTier,
  onSelectTier,
  pricingTiers,
  telegramUserId,
  neonUserId,
  onChangeStyle,
}) => {
  const radioGroupRef = useRef<HTMLDivElement>(null)
  
  // Feature flags
  const { stylesEnabled } = useFeatureFlags()
  
  // Fetch active pack for display (only if styles enabled)
  const { activePack, isLoading: packLoading } = useActivePack(
    stylesEnabled ? telegramUserId : undefined, 
    stylesEnabled ? neonUserId : undefined
  )

  // Keyboard navigation for radio group (WCAG 2.1 compliant)
  const handleKeyDown = useCallback((e: React.KeyboardEvent, currentIndex: number) => {
    const tiers = pricingTiers
    let newIndex = currentIndex

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault()
        newIndex = (currentIndex + 1) % tiers.length
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault()
        newIndex = (currentIndex - 1 + tiers.length) % tiers.length
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (selectedTier) {
          onUpgrade(selectedTier)
        }
        return
      case 'Home':
        e.preventDefault()
        newIndex = 0
        break
      case 'End':
        e.preventDefault()
        newIndex = tiers.length - 1
        break
      default:
        return
    }

    onSelectTier(tiers[newIndex])
    // Focus the new card
    const cards = radioGroupRef.current?.querySelectorAll('[role="radio"]')
    if (cards?.[newIndex]) {
      (cards[newIndex] as HTMLElement).focus()
    }
  }, [pricingTiers, onSelectTier, onUpgrade, selectedTier])

  return (
  <div className="space-y-6 pb-24 sm:pb-6">
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors active:scale-95"
        aria-label="Назад"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div>
        <h2 className="text-lg font-semibold">Выберите пакет</h2>
      </div>
    </div>
    
    {/* Selected Style Block - only show if styles feature is enabled */}
    {stylesEnabled && activePack && (
      <div className="p-3 bg-muted/30 rounded-xl border border-border">
        <div className="flex items-center gap-3">
          {/* Preview image or emoji */}
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            {activePack.previewImages?.[0] ? (
              <img 
                src={activePack.previewImages[0]} 
                alt={activePack.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">
                {activePack.iconEmoji || <Palette className="w-6 h-6 text-muted-foreground" />}
              </div>
            )}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Стиль</p>
            <p className="font-medium truncate">
              {activePack.iconEmoji && <span className="mr-1">{activePack.iconEmoji}</span>}
              {activePack.name}
            </p>
          </div>
          
          {/* Change button */}
          {onChangeStyle && (
            <button
              onClick={onChangeStyle}
              className="text-sm text-primary hover:underline flex-shrink-0"
            >
              Изменить
            </button>
          )}
        </div>
      </div>
    )}
    
    {/* Loading state for pack - only show if styles feature is enabled */}
    {stylesEnabled && packLoading && !activePack && (
      <div className="p-3 bg-muted/30 rounded-xl border border-border animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg bg-muted" />
          <div className="flex-1">
            <div className="h-3 w-12 bg-muted rounded mb-2" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
        </div>
      </div>
    )}
    <div className="space-y-3" role="radiogroup" aria-label="Выберите пакет фотографий" ref={radioGroupRef}>
      {pricingTiers.map((tier, index) => (
        <Card
          key={tier.id}
          onClick={() => onSelectTier(tier)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          tabIndex={selectedTier?.id === tier.id ? 0 : -1}
          className={cn(
            "w-full cursor-pointer transition-all hover-lift active-press shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]",
            selectedTier?.id === tier.id
              ? "border-primary bg-gradient-to-br from-primary/10 to-[var(--accent-purple)]/5 shadow-[var(--shadow-lg)] shadow-primary/20 ring-2 ring-primary/20"
              : "hover:border-muted-foreground/30 hover:bg-muted/30"
          )}
          role="radio"
          aria-checked={selectedTier?.id === tier.id}
          aria-describedby={`tier-desc-${tier.id}`}
        >
          <CardHeader className="flex flex-row items-center gap-4 p-4 sm:p-5">
            <div
              className={cn(
                "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-all",
                selectedTier?.id === tier.id
                  ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-primary/30"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <span className="text-2xl font-bold">{tier.photos}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold text-lg text-foreground">{tier.photos} фотографий</h3>
                {tier.popular && (
                  <Badge variant="popular" className="text-xs">
                    <Star className="w-3 h-3 mr-1" /> Хит
                  </Badge>
                )}
              </div>
              <p id={`tier-desc-${tier.id}`} className="text-sm text-muted-foreground">
                {tier.id === "starter"
                  ? "Попробовать AI-фото"
                  : tier.id === "standard"
                    ? "Оптимальный выбор"
                    : "Максимум возможностей"}
              </p>
            </div>
            <div className="text-right shrink-0">
              {tier.discount && tier.discount > 0 && tier.originalPrice ? (
                <>
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-sm line-through text-muted-foreground">{tier.originalPrice} ₽</span>
                    <Badge variant="success" className="text-xs">
                      <Percent className="w-3 h-3 mr-0.5" />-{tier.discount}%
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{tier.price} ₽</div>
                </>
              ) : (
                <div className="text-2xl font-bold text-foreground">{tier.price} ₽</div>
              )}
              <div className="text-xs text-muted-foreground">{Math.round(tier.price / tier.photos)} ₽/фото</div>
            </div>
          </CardHeader>
          {selectedTier?.id === tier.id && (
            <CardContent className="pt-0 pb-4 px-4 sm:px-5">
              <div className="flex items-center gap-1 text-primary text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Выбрано
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-20 bg-background/80 backdrop-blur-lg border-t border-border sm:relative sm:p-0 sm:pb-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:z-auto safe-area-inset-bottom">
      <Button
        onClick={() => selectedTier && onUpgrade(selectedTier)}
        disabled={!selectedTier || isGenerating || isProcessingPayment}
        variant="gradient"
        size="xl"
        className="w-full sm:w-auto"
      >
        {(isGenerating || isProcessingPayment) ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {isGenerating ? "Генерация..." : "Обработка..."}
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Оплатить и получить {selectedTier?.photos || 0} фото
          </>
        )}
      </Button>
    </div>
  </div>
  )
}

export default TierSelectView
