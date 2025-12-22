# MOBILE UX CRITICAL FIXES - Quick Implementation Guide
**PinGlass Telegram Mini App**
**Date:** 2025-12-20

This document provides copy-paste code snippets to fix the critical mobile UX issues identified in the audit.

---

## PRIORITY 1: CRITICAL FIXES (Must Fix Before Launch)

### Fix 1: Add Safe Area Insets to Header

**File:** `components/persona-app.tsx` (Line 731)

**Current:**
```tsx
<header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-black/5">
```

**Fixed:**
```tsx
<header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-black/5 safe-area-inset-top">
```

**Also add to `styles/globals.css` if not using utility:**
```css
/* Ensure this class exists */
.safe-area-inset-top {
  padding-top: env(safe-area-inset-top, 0);
}
```

---

### Fix 2: Add Horizontal Safe Area Padding

**File:** `components/persona-app.tsx` (Line 768)

**Current:**
```tsx
<main className="max-w-5xl mx-auto px-4 py-6">
```

**Fixed Option A (Inline Style):**
```tsx
<main
  className="max-w-5xl mx-auto py-6"
  style={{
    paddingLeft: 'max(1rem, env(safe-area-inset-left))',
    paddingRight: 'max(1rem, env(safe-area-inset-right))',
  }}
>
```

**Fixed Option B (CSS Class):**
```tsx
<main className="max-w-5xl mx-auto px-safe py-6">
```

**Add to `styles/globals.css`:**
```css
.px-safe {
  padding-left: max(1rem, env(safe-area-inset-left));
  padding-right: max(1rem, env(safe-area-inset-right));
}
```

---

### Fix 3: Initialize Telegram WebApp SDK

**File:** `components/hooks/useAuth.ts` (or create new `hooks/useTelegramApp.ts`)

**Create new hook:**
```tsx
// hooks/useTelegramApp.ts
import { useEffect } from 'react'

export function useTelegramApp() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const tg = window.Telegram?.WebApp

    if (tg) {
      // Expand to full screen
      tg.expand()

      // Enable closing confirmation
      tg.enableClosingConfirmation()

      // Set header color to match theme
      tg.setHeaderColor('#1a0a10') // Your --background color

      // Ready signal
      tg.ready()

      console.log('[Telegram] WebApp initialized:', {
        version: tg.version,
        platform: tg.platform,
        colorScheme: tg.colorScheme,
      })
    }

    return () => {
      tg?.disableClosingConfirmation()
    }
  }, [])
}
```

**Use in `persona-app.tsx` (after line 56):**
```tsx
export default function PersonaApp() {
  // Custom hooks
  const { userIdentifier, authStatus, telegramUserId, theme, toggleTheme, showMessage } = useAuth()
  useTelegramApp() // ADD THIS LINE
  const { personas, setPersonas, loadAvatarsFromServer, createPersona, updatePersona, deletePersona, getPersona } = useAvatars()
  // ... rest of hooks
```

---

### Fix 4: Fix Delete Button Touch Targets

**File:** `components/views/upload-view.tsx` (Line 130)

**Current:**
```tsx
<button
  onClick={() => removeImage(img.id)}
  className="absolute top-1.5 right-1.5 w-8 h-8 flex items-center justify-center bg-black/60 hover:bg-red-500 active:bg-red-600 rounded-lg text-white opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all touch-manipulation"
  aria-label="Удалить фото"
>
  <X className="w-4 h-4" />
</button>
```

**Fixed:**
```tsx
<button
  onClick={() => removeImage(img.id)}
  className="absolute top-1 right-1 w-11 h-11 flex items-center justify-center bg-black/60 hover:bg-red-500 active:bg-red-600 rounded-lg text-white opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all touch-manipulation"
  aria-label="Удалить фото"
>
  <X className="w-5 h-5" />
</button>
```

**File:** `components/views/dashboard-view.tsx` (Line 136)

**Current:**
```tsx
<button
  onClick={(e) => onDelete(persona.id, e)}
  className="absolute top-2 right-2 w-9 h-9 sm:w-8 sm:h-8 p-0 bg-black/50 hover:bg-red-500 active:bg-red-600 rounded-full text-white flex items-center justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all touch-manipulation"
  aria-label="Удалить аватар"
>
  <X className="w-4 h-4" />
</button>
```

**Fixed:**
```tsx
<button
  onClick={(e) => onDelete(persona.id, e)}
  className="absolute top-2 right-2 w-11 h-11 p-0 bg-black/50 hover:bg-red-500 active:bg-red-600 rounded-full text-white flex items-center justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all touch-manipulation"
  aria-label="Удалить аватар"
>
  <X className="w-5 h-5" />
</button>
```

---

### Fix 5: Add Safe Area to Fixed Bottom Bars

**File:** `components/views/tier-select-view.tsx` (Line 95)

**Current:**
```tsx
<div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border sm:relative sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 safe-area-inset-bottom">
```

**Fixed:**
```tsx
<div
  className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border sm:relative sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 safe-area-inset-bottom"
  style={{
    paddingLeft: 'max(1rem, env(safe-area-inset-left))',
    paddingRight: 'max(1rem, env(safe-area-inset-right))',
  }}
>
```

**Apply same fix to:**
- `components/views/upload-view.tsx` (Line 139)
- Any other fixed bottom bars

---

## PRIORITY 2: HIGH PRIORITY FIXES

### Fix 6: Add Haptic Feedback

**Create utility function:**
```tsx
// lib/haptics.ts
export const haptics = {
  light: () => {
    if (typeof window !== 'undefined') {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
    }
  },
  medium: () => {
    if (typeof window !== 'undefined') {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium')
    }
  },
  heavy: () => {
    if (typeof window !== 'undefined') {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('heavy')
    }
  },
  success: () => {
    if (typeof window !== 'undefined') {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success')
    }
  },
  error: () => {
    if (typeof window !== 'undefined') {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error')
    }
  },
  warning: () => {
    if (typeof window !== 'undefined') {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning')
    }
  },
}
```

**Add to buttons:**

```tsx
// Example: Payment button (payment-modal.tsx)
<button
  onClick={() => {
    haptics.medium() // ADD THIS
    handlePayment()
  }}
  className="w-full py-4 bg-primary..."
>
  Оплатить {tier.price} ₽
</button>

// Example: Delete button
<button
  onClick={(e) => {
    haptics.heavy() // ADD THIS
    onDelete(persona.id, e)
  }}
>
  <X />
</button>

// Example: Success state
useEffect(() => {
  if (generationComplete) {
    haptics.success() // ADD THIS
  }
}, [generationComplete])

// Example: Error state
if (error) {
  haptics.error() // ADD THIS
  showMessage(error)
}
```

---

### Fix 7: Add ARIA Labels to Icon Buttons

**File:** `components/persona-app.tsx`

**Current:**
```tsx
<button
  onClick={() => setIsReferralOpen(true)}
  className="p-2.5 rounded-xl..."
  title="Партнёрская программа"
>
  <Gift className="w-4 h-4" />
</button>
```

**Fixed:**
```tsx
<button
  onClick={() => setIsReferralOpen(true)}
  className="p-2.5 rounded-xl..."
  aria-label="Партнёрская программа"
>
  <Gift className="w-4 h-4" />
</button>
```

**Apply to all icon-only buttons:**
```tsx
// Theme toggle
<button
  onClick={toggleTheme}
  aria-label={theme === "dark" ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
>
  {theme === "dark" ? <Sun /> : <Moon />}
</button>

// Back buttons
<button
  onClick={onBack}
  aria-label="Назад"
>
  <ArrowLeft />
</button>

// Close buttons
<button
  onClick={onClose}
  aria-label="Закрыть"
>
  <X />
</button>
```

---

### Fix 8: Add Loading State ARIA

**File:** All components with `Loader2`

**Current:**
```tsx
<Loader2 className="w-8 h-8 animate-spin text-primary" />
```

**Fixed:**
```tsx
<Loader2
  className="w-8 h-8 animate-spin text-primary"
  role="status"
  aria-label="Загрузка"
/>
<span className="sr-only">Загрузка...</span>
```

**Add screen reader utility to `globals.css`:**
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

### Fix 9: Toast Notification System

**Create toast component:**
```tsx
// components/toast.tsx
'use client'

import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'info' | 'success' | 'error' | 'warning'
  duration?: number
  onClose: () => void
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  const bgColor = {
    info: 'bg-card border-border',
    success: 'bg-green-500/10 border-green-500/30',
    error: 'bg-red-500/10 border-red-500/30',
    warning: 'bg-amber-500/10 border-amber-500/30',
  }[type]

  const textColor = {
    info: 'text-foreground',
    success: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
  }[type]

  return (
    <div
      className={`fixed bottom-20 left-4 right-4 mx-auto max-w-sm p-4 rounded-2xl border-2 ${bgColor} shadow-2xl backdrop-blur-xl z-[200] animate-in slide-in-from-bottom-4 safe-area-inset-bottom`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <p className={`flex-1 text-sm font-medium ${textColor}`}>{message}</p>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded-lg transition-colors"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Toast container and hook
export function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastProps['type'] }>>([])

  const showToast = (message: string, type: ToastProps['type'] = 'info') => {
    const id = Math.random().toString()
    setToasts(prev => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const ToastContainer = () => (
    <>
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </>
  )

  return { showToast, ToastContainer }
}
```

**Usage:**
```tsx
// In persona-app.tsx or component
const { showToast, ToastContainer } = useToast()

// Replace alert()
// alert("Ошибка загрузки")
showToast("Ошибка загрузки", "error")

// Replace confirm() - show toast first
// if (confirm("Удалить?"))
showToast("Удалить аватар?", "warning")
// Then show custom modal for confirmation

// Render toasts
return (
  <div>
    {/* Your app content */}
    <ToastContainer />
  </div>
)
```

---

### Fix 10: Input Font Size for iOS

**File:** `components/payment-modal.tsx` (Line 258)

**Current:**
```tsx
<input
  className={`w-full px-4 py-3 rounded-xl border-2 bg-background...`}
/>
```

**Fixed:**
```tsx
<input
  className={`w-full px-4 py-3 text-base rounded-xl border-2 bg-background...`}
  // text-base = 16px, prevents iOS zoom
/>
```

---

### Fix 11: File Upload Error Feedback

**File:** `components/views/upload-view.tsx`

**Current:**
```tsx
const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  // ...
  for (let i = 0; i < e.target.files.length; i++) {
    const file = e.target.files[i]

    if (file.size > MAX_FILE_SIZE) {
      continue // Silent skip
    }
  }
}
```

**Fixed (with toast):**
```tsx
import { useToast } from '../toast'

export const UploadView: React.FC<UploadViewProps> = ({ ... }) => {
  const { showToast, ToastContainer } = useToast()

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // ...
    const rejected: string[] = []

    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i]

      if (!VALID_TYPES.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)) {
        rejected.push(`${file.name} (неподдерживаемый формат)`)
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name} (>10MB)`)
        continue
      }

      newImages.push({...})
    }

    // Show rejection feedback
    if (rejected.length > 0) {
      showToast(
        `Пропущено ${rejected.length} файлов: ${rejected.slice(0, 2).join(', ')}${rejected.length > 2 ? '...' : ''}`,
        'warning'
      )
    }

    // ... rest of function
  }

  return (
    <div>
      {/* Your upload view content */}
      <ToastContainer />
    </div>
  )
}
```

---

## PRIORITY 3: MEDIUM PRIORITY FIXES

### Fix 12: Respect Reduced Motion Preference

**Add to `styles/globals.css`:**
```css
@media (prefers-reduced-motion: reduce) {
  /* Disable all animations */
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  /* Specifically target logo animations */
  .pinglass-logo,
  .pinglass-logo-compact,
  .animate-orbit,
  .animate-orbit-reverse,
  .animate-orbit-smooth,
  .animate-orbit-smooth-reverse,
  .animate-holographic-border,
  .animate-neon-flicker,
  .animate-pulse-glow {
    animation: none !important;
  }
}
```

---

### Fix 13: Sync Theme with Telegram

**File:** `components/hooks/useAuth.ts` (or new `hooks/useTelegramTheme.ts`)

```tsx
import { useEffect } from 'react'

export function useTelegramTheme(currentTheme: string, setTheme: (theme: string) => void) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const tg = window.Telegram?.WebApp
    if (!tg) return

    // Sync initial theme
    const telegramTheme = tg.colorScheme
    if (telegramTheme && telegramTheme !== currentTheme) {
      setTheme(telegramTheme)
    }

    // Listen for theme changes
    const handleThemeChange = () => {
      const newTheme = tg.colorScheme
      if (newTheme) {
        setTheme(newTheme)
      }
    }

    tg.onEvent('themeChanged', handleThemeChange)

    return () => {
      tg.offEvent('themeChanged', handleThemeChange)
    }
  }, [currentTheme, setTheme])
}
```

---

### Fix 14: Add Focus Indicators

**Add to `styles/globals.css`:**
```css
/* Focus indicators for keyboard navigation */
button:focus-visible,
a:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* Enhanced focus for custom components */
.btn-premium:focus-visible,
.btn-secondary:focus-visible,
.btn-ghost:focus-visual {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px oklch(0.70 0.16 350 / 0.2);
}
```

---

## TESTING CHECKLIST

After applying fixes, test on:

### Devices
- [ ] iPhone 14 Pro (Dynamic Island)
- [ ] iPhone SE (older notch)
- [ ] Samsung Galaxy S23 (punch hole)
- [ ] Pixel 7 Pro
- [ ] iPad (tablet mode)

### Telegram Mini App
- [ ] Launch in Telegram iOS
- [ ] Launch in Telegram Android
- [ ] Test theme switching (light/dark)
- [ ] Test haptic feedback (enable in Telegram settings)
- [ ] Test closing confirmation (try to close app)

### Accessibility
- [ ] Navigate with VoiceOver (iOS)
- [ ] Navigate with TalkBack (Android)
- [ ] Test keyboard navigation (Tab key)
- [ ] Test at 200% zoom
- [ ] Test with reduced motion enabled

### Safe Areas
- [ ] Check header on notched phones
- [ ] Check bottom bar on phones with home indicator
- [ ] Check horizontal padding on all devices
- [ ] Rotate to landscape (if supported)

---

## IMPLEMENTATION ORDER

**Day 1 (2-3 hours):**
1. Fix 1: Safe area header
2. Fix 2: Safe area main
3. Fix 3: Initialize Telegram SDK
4. Fix 4: Delete button sizes
5. Fix 5: Bottom bar safe areas

**Day 2 (3-4 hours):**
6. Fix 6: Haptic feedback (utility + 10-15 instances)
7. Fix 7: ARIA labels (all icon buttons)
8. Fix 8: Loading state ARIA
9. Fix 10: Input font sizes

**Day 3 (2-3 hours):**
10. Fix 9: Toast system
11. Fix 11: File upload errors
12. Testing on real devices

**Day 4 (2 hours):**
13. Fix 12: Reduced motion
14. Fix 13: Telegram theme sync
15. Fix 14: Focus indicators
16. Final testing

**Total Time: 9-12 hours**

---

## VALIDATION

After implementing all fixes, run:

```bash
# Lighthouse mobile audit
npm run build
npx lighthouse https://your-app.vercel.app --preset=mobile --view

# Accessibility scan
npx axe https://your-app.vercel.app

# Bundle size check
npx next-bundle-analyzer
```

**Target Scores:**
- Performance: >90
- Accessibility: 100
- Best Practices: 100
- SEO: >90

---

## SUPPORT

If you encounter issues:

1. **Safe area not working?**
   - Check `viewport-fit=cover` in layout.tsx (already set ✓)
   - Test on real device (not simulator)

2. **Telegram SDK not available?**
   - Check script is loaded: `<script src="https://telegram.org/js/telegram-web-app.js" />`
   - Test in actual Telegram app (not browser)

3. **Haptics not working?**
   - Enable in Telegram: Settings → Data and Storage → Use Less Data (OFF)
   - Only works on physical devices

4. **Theme sync issues?**
   - Telegram may cache theme
   - Force close and reopen app

---

**Last Updated:** 2025-12-20
**Status:** Ready for implementation
