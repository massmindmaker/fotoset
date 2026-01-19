'use client'

import { User, Palette, Video } from 'lucide-react'
import { cn } from '@/lib/utils'

type BottomTab = 'avatars' | 'styles' | 'video'

interface BottomNavProps {
  activeTab: BottomTab
  onTabChange: (tab: BottomTab) => void
}

interface TabConfig {
  id: BottomTab
  label: string
  icon: typeof User
  disabled?: boolean
  badge?: string
}

const tabs: TabConfig[] = [
  { id: 'avatars', label: 'Аватары', icon: User },
  { id: 'styles', label: 'Стили', icon: Palette },
  { id: 'video', label: 'Видео', icon: Video, disabled: true, badge: 'Скоро' },
]

function triggerHaptic() {
  if (typeof window !== 'undefined') {
    const tg = (window as Window & { Telegram?: { WebApp?: { HapticFeedback?: { impactOccurred: (style: string) => void } } } }).Telegram
    tg?.WebApp?.HapticFeedback?.impactOccurred('light')
  }
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const handleTabClick = (tab: TabConfig) => {
    if (tab.disabled) return
    triggerHaptic()
    onTabChange(tab.id)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border/50"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <div className="flex h-14 items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const isDisabled = tab.disabled

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              disabled={isDisabled}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors',
                isActive && !isDisabled && 'text-primary',
                !isActive && !isDisabled && 'text-muted-foreground hover:text-foreground',
                isDisabled && 'cursor-not-allowed text-muted-foreground/50'
              )}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    'h-5 w-5 transition-transform',
                    isActive && !isDisabled && 'scale-110'
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {tab.badge && (
                  <span className="absolute -right-6 -top-1.5 rounded-full bg-primary/90 px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium',
                  isActive && !isDisabled && 'font-semibold'
                )}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export type { BottomTab, BottomNavProps }
