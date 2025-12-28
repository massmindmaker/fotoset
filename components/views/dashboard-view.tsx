"use client"

import type React from "react"
import { Plus, X, ChevronRight, Zap, Shield, Star } from "lucide-react"
import Link from "next/link"
import type { Persona, PricingTier } from "./types"

export const PRICING_TIERS: PricingTier[] = [
  { id: "starter", photos: 7, price: 499 },
  { id: "standard", photos: 15, price: 999, popular: true },
  { id: "premium", photos: 23, price: 1499 },
]

export interface DashboardViewProps {
  personas: Persona[]
  onCreate: () => void
  onSelect: (id: string) => void
  onDelete: (id: string, e: React.MouseEvent) => void
  isLoading?: boolean
}

export const DashboardView: React.FC<DashboardViewProps> = ({ personas, onCreate, onSelect, onDelete, isLoading = false }) => (
  <div className="space-y-6 view-transition-name-main">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Мои аватары</h1>
      <p className="text-muted-foreground text-sm mt-1">Создавайте AI-фотографии в стиле PINGLASS</p>
    </div>
    {isLoading ? (
      <div className="skeleton-grid">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-avatar" />
          </div>
        ))}
      </div>
    ) : personas.length === 0 ? (
      <div className="space-y-6">
        <button
          onClick={onCreate}
          className="w-full p-5 sm:p-8 bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 rounded-3xl border-2 border-dashed border-primary/30 hover:border-primary/50 active:border-primary/60 transition-all group text-left shadow-xl shadow-primary/5 hover:shadow-2xl hover:shadow-primary/10 hover-lift active-press"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 group-hover:from-primary/30 group-hover:to-accent/20 transition-all flex items-center justify-center shadow-lg shadow-primary/10 group-hover:shadow-xl group-hover:shadow-primary/15 hover-glow">
              <Plus className="w-8 h-8 text-primary drop-shadow-sm transition-transform group-hover:scale-110" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-1">Создать первый аватар</h3>
              <p className="text-muted-foreground text-sm">
                Загрузите 10-20 своих фото и получите до 23 профессиональных портрета
              </p>
            </div>
            <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors hidden sm:block" />
          </div>
        </button>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Тарифы</h3>
          <div className="grid grid-cols-3 gap-3">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.id}
                className={
                  "p-3 sm:p-4 rounded-2xl border transition-all touch-manipulation hover-lift active-press " +
                  (tier.popular
                    ? "bg-gradient-to-br from-primary/10 to-accent/5 border-primary/40 shadow-lg shadow-primary/10 hover:shadow-xl hover:shadow-primary/15 hover-glow"
                    : "bg-card border-border shadow-md shadow-black/5 hover:shadow-lg")
                }
              >
                {tier.popular && (
                  <div className="text-[10px] sm:text-xs text-primary font-medium mb-1 flex items-center gap-1">
                    <Star className="w-3 h-3" /> Хит
                  </div>
                )}
                <div className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  {tier.photos}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">фото</div>
                <div className="text-xs sm:text-sm font-semibold mt-1.5 sm:mt-2">{tier.price} ₽</div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 card-premium hover-lift">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 transition-all group hover:bg-primary/20 hover-glow">
              <Zap className="w-5 h-5 text-primary transition-transform group-hover:scale-110" />
            </div>
            <p className="text-sm font-medium">До 23 фото</p>
            <p className="text-xs text-muted-foreground">На выбор</p>
          </div>
          <div className="p-4 card-premium hover-lift">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center mb-3 transition-all group hover:bg-green-500/20 hover-glow">
              <Shield className="w-5 h-5 text-green-500 transition-transform group-hover:scale-110" />
            </div>
            <p className="text-sm font-medium">Безопасно</p>
            <p className="text-xs text-muted-foreground">Фото не сохраняются</p>
          </div>
        </div>
      </div>
    ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <button
          onClick={onCreate}
          className="aspect-[4/5] rounded-2xl border-2 border-dashed border-border hover:border-primary/50 active:border-primary/60 hover:bg-muted/50 active:bg-muted/70 transition-all flex flex-col items-center justify-center gap-2 sm:gap-3 group touch-manipulation hover-lift active-press"
        >
          <div className="w-14 h-14 sm:w-12 sm:h-12 rounded-full bg-muted group-hover:bg-primary/10 group-active:bg-primary/20 transition-colors flex items-center justify-center">
            <Plus className="w-7 h-7 sm:w-6 sm:h-6 text-muted-foreground group-hover:text-primary" />
          </div>
          <span className="text-xs sm:text-sm font-medium text-muted-foreground group-hover:text-foreground">Новый</span>
        </button>
        {personas.map((persona) => (
          <div
            key={persona.id}
            onClick={() => onSelect(persona.id)}
            className="aspect-[4/5] card-premium overflow-hidden relative cursor-pointer group hover-lift active-press"
          >
            <img
              src={persona.thumbnailUrl || "/placeholder-user.jpg"}
              alt={persona.name}
              className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent p-3 flex flex-col justify-end">
              <h3 className="text-sm font-semibold text-white truncate">{persona.name}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={
                    "w-1.5 h-1.5 rounded-full " + (persona.status === "ready" ? "bg-green-400" : persona.status === "processing" ? "bg-blue-400 animate-pulse" : "bg-amber-400")
                  }
                />
                <span className="text-[10px] text-white/80">
                  {persona.status === "ready"
                    ? "Готово"
                    : persona.status === "processing"
                      ? "Генерация..."
                      : "Черновик"}
                </span>
              </div>
              {/* Show "View Results" button for avatars with generated photos */}
              {persona.generatedAssets.length > 0 && (
                <div className="mt-2 px-2 py-1 bg-primary/80 backdrop-blur-sm rounded-lg text-center">
                  <span className="text-[10px] font-medium text-white">Смотреть результат</span>
                </div>
              )}
            </div>
            <button
              onClick={(e) => onDelete(persona.id, e)}
              className="absolute top-2 right-2 w-9 h-9 sm:w-8 sm:h-8 p-0 bg-black/50 hover:bg-red-500 active:bg-red-600 rounded-full text-white flex items-center justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all touch-manipulation"
              aria-label="Удалить аватар"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
)

export default DashboardView
