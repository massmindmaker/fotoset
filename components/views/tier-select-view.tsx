"use client"

import type React from "react"
import { ArrowLeft, Sparkles, CheckCircle2, Loader2, Star, Percent } from "lucide-react"
import type { Persona, PricingTier } from "./types"

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
}) => (
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
        <p className="text-sm text-muted-foreground">PINGLASS</p>
      </div>
    </div>
    <div className="space-y-3" role="radiogroup" aria-label="Выберите пакет фотографий">
      {pricingTiers.map((tier, index) => (
        <button
          key={tier.id}
          onClick={() => onSelectTier(tier)}
          className={
            "w-full p-4 sm:p-5 rounded-3xl transition-all border-2 text-left hover-lift active-press " +
            (selectedTier?.id === tier.id
              ? "border-primary bg-gradient-to-br from-primary/10 to-accent/5 shadow-2xl shadow-primary/20 ring-2 ring-primary/10 hover-glow"
              : "border-transparent card-premium hover:bg-muted/50")
          }
          role="radio"
          aria-checked={selectedTier?.id === tier.id}
          aria-describedby={`tier-desc-${tier.id}`}
        >
          <div className="flex items-center gap-4">
            <div
              className={
                "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-all hover-scale " +
                (selectedTier?.id === tier.id
                  ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-primary/30 hover-glow"
                  : "bg-muted text-muted-foreground shadow-black/10")
              }
            >
              <span className="text-2xl font-bold drop-shadow-sm">{tier.photos}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg text-foreground">{tier.photos} фотографий</h3>
                {tier.popular && (
                  <span className="px-2.5 py-1 bg-gradient-to-r from-accent/30 to-accent/10 text-accent text-xs font-medium rounded-full flex items-center gap-1 shadow-sm">
                    <Star className="w-3 h-3" /> Хит
                  </span>
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
                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-600 text-xs font-medium rounded-md flex items-center gap-0.5">
                      <Percent className="w-3 h-3" />-{tier.discount}%
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{tier.price} ₽</div>
                </>
              ) : (
                <div className="text-2xl font-bold text-foreground">{tier.price} ₽</div>
              )}
              <div className="text-xs text-muted-foreground">{Math.round(tier.price / tier.photos)} ₽/фото</div>
            </div>
          </div>
          {selectedTier?.id === tier.id && (
            <div className="flex items-center gap-1 mt-3 text-primary text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Выбрано
            </div>
          )}
        </button>
      ))}
    </div>
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border sm:relative sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 safe-area-inset-bottom">
      <button
        onClick={() => selectedTier && onUpgrade(selectedTier)}
        disabled={!selectedTier || isGenerating || isProcessingPayment}
        className="w-full sm:w-auto btn-premium disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {(isGenerating || isProcessingPayment) ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {isGenerating ? "Генерация..." : "Обработка..."}
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Оплатить и получить {selectedTier.photos} фото
          </>
        )}
      </button>
    </div>
  </div>
)

export default TierSelectView
