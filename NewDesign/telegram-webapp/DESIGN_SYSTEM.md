# PinGlass Telegram WebApp Design System

Comprehensive design system documentation for PinGlass Telegram Mini App, optimized for mobile-first experiences within the Telegram ecosystem.

**Version:** 1.0.0
**Last Updated:** 2026-01-17
**Platform:** Telegram Mini Apps (WebApp SDK v7.x)

---

## Table of Contents

1. [Telegram WebApp Constraints](#1-telegram-webapp-constraints)
2. [Color Adaptations](#2-color-adaptations)
3. [Typography Adjustments](#3-typography-adjustments)
4. [Layout Patterns](#4-layout-patterns)
5. [Component Adaptations](#5-component-adaptations)
6. [Telegram-Specific Features](#6-telegram-specific-features)
7. [Screen Inventory](#7-screen-inventory-mobile-first)
8. [Performance Considerations](#8-performance-considerations)

---

## 1. Telegram WebApp Constraints

### 1.1 Viewport Limitations

Telegram Mini Apps operate within a constrained viewport that varies by device and Telegram client state.

```typescript
// Access viewport dimensions
const tg = window.Telegram?.WebApp

// Fixed height (excludes keyboard)
const stableHeight = tg.viewportStableHeight // Use for fixed elements

// Dynamic height (changes with keyboard)
const dynamicHeight = tg.viewportHeight

// Set CSS custom property for height-based calculations
document.documentElement.style.setProperty('--tg-vh', `${tg.viewportStableHeight}px`)
```

**Viewport Behavior:**

| State | Typical Height (iPhone 14) | Notes |
|-------|---------------------------|-------|
| Collapsed | 300-400px | Initial Mini App state |
| Expanded | 700-844px | After `tg.expand()` call |
| With keyboard | 350-450px | Input focus active |
| Dynamic Island | -47px from top | iPhone 14 Pro+ |

**CSS Usage:**

```css
/* Use stable viewport height for full-screen layouts */
.app-container {
  height: var(--tg-vh, 100vh);
  min-height: var(--tg-vh, 100vh);
  max-height: var(--tg-vh, 100vh);
  overflow: hidden;
}

/* Scrollable content area */
.content-scroll {
  height: calc(var(--tg-vh, 100vh) - 60px); /* Minus header */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
```

### 1.2 Safe Areas

Telegram WebApps must account for device-specific safe areas (notch, Dynamic Island, home indicator).

```css
/* Safe area CSS variables (from PinGlass globals.css) */
.safe-area-inset-top {
  padding-top: env(safe-area-inset-top, 0);
}

.safe-area-inset-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.safe-area-inset-all {
  padding: env(safe-area-inset-top, 0)
           env(safe-area-inset-right, 0)
           env(safe-area-inset-bottom, 0)
           env(safe-area-inset-left, 0);
}

/* Fixed bottom bar with safe area */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  background: oklch(0.16 0.035 350 / 0.95);
  backdrop-filter: blur(20px);
}

/* Bottom sheet with safe area */
.bottom-sheet-safe {
  border-radius: 24px 24px 0 0;
  padding-bottom: max(24px, calc(16px + env(safe-area-inset-bottom)));
}
```

**Safe Area Reference:**

| Device | Top Inset | Bottom Inset | Side Insets |
|--------|-----------|--------------|-------------|
| iPhone SE/8 | 0px | 0px | 0px |
| iPhone 12/13/14 | 47px | 34px | 0px |
| iPhone 14 Pro | 59px (Dynamic Island) | 34px | 0px |
| iPhone 15 Pro | 59px | 34px | 0px |
| Android (typical) | 24-48px | 0-48px | 0px |

### 1.3 Telegram Theme Detection

Telegram provides real-time theme information that PinGlass must respect.

```typescript
// From useAuth.ts - Theme sync implementation
useEffect(() => {
  const tg = window.Telegram?.WebApp
  if (!tg) return

  const syncTheme = () => {
    const tgTheme = tg.colorScheme || 'light' // 'light' | 'dark'
    setTheme(tgTheme)
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(tgTheme)
  }

  // Initial sync
  syncTheme()

  // Listen for theme changes (user toggles Telegram theme)
  tg.onEvent('themeChanged', syncTheme)

  return () => {
    tg.offEvent('themeChanged', syncTheme)
  }
}, [])
```

**Available Theme Parameters:**

```typescript
interface TelegramThemeParams {
  bg_color: string         // Main background
  text_color: string       // Primary text
  hint_color: string       // Secondary/muted text
  link_color: string       // Link color (typically blue)
  button_color: string     // Primary button background
  button_text_color: string // Primary button text
  secondary_bg_color?: string // Card backgrounds (v7.0+)
  header_bg_color?: string    // Header background (v7.0+)
  accent_text_color?: string  // Accent color (v7.0+)
  section_bg_color?: string   // Section backgrounds (v7.0+)
  section_header_text_color?: string // Section headers (v7.0+)
  subtitle_text_color?: string // Subtitle text (v7.0+)
  destructive_text_color?: string // Destructive actions (v7.0+)
}
```

### 1.4 Native Controls Integration

Telegram provides native header controls that replace web-based navigation.

```typescript
// Telegram provides these native controls:
interface TelegramNativeControls {
  BackButton: TelegramBackButton    // Native back button in header
  MainButton: TelegramMainButton    // Fixed bottom CTA button
  SettingsButton: TelegramSettingsButton // Settings gear (v7.0+)
}
```

**PinGlass Usage Pattern:**

```typescript
// From persona-app.tsx - BackButton integration
useEffect(() => {
  const tg = window.Telegram?.WebApp
  if (!tg?.BackButton) return

  const showBackButton = viewState.view !== 'DASHBOARD' && viewState.view !== 'ONBOARDING'

  if (showBackButton) {
    const handleBackClick = () => {
      hapticImpact('light')
      setViewState({ view: 'DASHBOARD' })
    }

    tg.BackButton.onClick(handleBackClick)
    tg.BackButton.show()

    return () => {
      tg.BackButton.offClick(handleBackClick)
      tg.BackButton.hide()
    }
  } else {
    tg.BackButton.hide()
  }
}, [viewState.view, hapticImpact])
```

---

## 2. Color Adaptations

### 2.1 Telegram Theme Token Mapping

PinGlass design tokens map to Telegram's theme system while maintaining brand identity.

| PinGlass Token | Telegram Token | Light Value | Dark Value |
|----------------|----------------|-------------|------------|
| `--background` | `bg_color` | `oklch(0.99 0.002 0)` | `oklch(0.15 0.02 350)` |
| `--foreground` | `text_color` | `oklch(0.20 0.02 350)` | `oklch(0.96 0.01 0)` |
| `--muted-foreground` | `hint_color` | `oklch(0.38 0.02 350)` | `oklch(0.65 0.02 350)` |
| `--primary` | `button_color` | `oklch(0.48 0.22 15)` | `oklch(0.70 0.20 15)` |
| `--primary-foreground` | `button_text_color` | `oklch(1 0 0)` | `oklch(0.10 0.02 350)` |
| `--card` | `secondary_bg_color` | `oklch(1 0 0)` | `oklch(0.18 0.025 350)` |
| `--border` | N/A (custom) | `oklch(0.92 0.012 350)` | `oklch(0.28 0.02 350)` |

### 2.2 PinGlass Brand Colors Preservation

The coral/pink brand identity is preserved across both themes.

```css
/* Brand colors - consistent across themes */
:root {
  /* Primary coral - WCAG AA compliant */
  --primary: oklch(0.48 0.22 15);           /* #B83232 - Light mode */
  --primary-vibrant: oklch(0.68 0.22 15);   /* #FF6B6B - Decorative only */

  /* Neon pink accent */
  --neon-pink: #FF1493;

  /* Purple accent (referral, special actions) */
  --accent-purple: oklch(0.65 0.18 290);
}

.dark {
  --primary: oklch(0.70 0.20 15);           /* Brighter for dark mode */
}
```

### 2.3 Adaptive Color CSS

```css
/* Telegram-aware color scheme */
.twa-adaptive {
  /* Use Telegram's colors when available, fallback to PinGlass */
  background: var(--tg-theme-bg-color, var(--background));
  color: var(--tg-theme-text-color, var(--foreground));
}

.twa-button-primary {
  background: var(--tg-theme-button-color, var(--primary));
  color: var(--tg-theme-button-text-color, var(--primary-foreground));
}

.twa-hint {
  color: var(--tg-theme-hint-color, var(--muted-foreground));
}

.twa-link {
  color: var(--tg-theme-link-color, var(--primary));
}
```

### 2.4 Payment Provider Colors

```css
/* Payment method brand colors */
.btn-payment-alt.btn-stars {
  /* Telegram Stars - Purple gradient */
  background: linear-gradient(135deg, oklch(0.22 0.04 280), oklch(0.18 0.03 270));
  border-color: oklch(0.55 0.15 280 / 0.3);
}

.btn-payment-alt.btn-ton {
  /* TON - Blue gradient */
  background: linear-gradient(135deg, oklch(0.22 0.03 230), oklch(0.18 0.02 220));
  border-color: oklch(0.50 0.12 230 / 0.3);
}

/* Provider brand colors */
:root {
  --provider-tbank: #E4003A;  /* T-Bank red */
  --provider-stars: #FFD700;  /* Telegram Stars gold */
  --provider-ton: #0088CC;    /* TON blue */
}
```

---

## 3. Typography Adjustments

### 3.1 Telegram WebApp Font Stack

Telegram Mini Apps inherit system fonts from the native Telegram client.

```css
/* PinGlass font stack optimized for Telegram */
:root {
  --font-sans:
    'Outfit',           /* Primary brand font */
    -apple-system,      /* iOS system font */
    'Roboto',           /* Android system font */
    system-ui,          /* System UI fallback */
    sans-serif;

  --font-display:
    'Playfair Display', /* Display/headline font */
    Georgia,
    serif;

  --font-mono:
    'JetBrains Mono',   /* Code font */
    'SF Mono',          /* iOS monospace */
    monospace;
}
```

### 3.2 Compact Typography Scale

Smaller base sizes for mobile-first Telegram experience.

| Token | Web Size | Telegram WebApp Size | Line Height |
|-------|----------|---------------------|-------------|
| `--text-xs` | 12px | 11px | 1.4 |
| `--text-sm` | 14px | 13px | 1.4 |
| `--text-base` | 16px | 15px | 1.5 |
| `--text-lg` | 18px | 16px | 1.5 |
| `--text-xl` | 20px | 18px | 1.4 |
| `--text-2xl` | 24px | 20px | 1.3 |
| `--text-3xl` | 30px | 24px | 1.2 |
| `--text-4xl` | 36px | 28px | 1.1 |

```css
/* Telegram WebApp typography overrides */
@media (max-width: 480px) {
  html {
    font-size: 15px; /* Slightly smaller base */
  }

  .text-xs { font-size: 0.733rem; }  /* 11px */
  .text-sm { font-size: 0.867rem; }  /* 13px */
  .text-base { font-size: 1rem; }    /* 15px */
  .text-lg { font-size: 1.067rem; }  /* 16px */
  .text-xl { font-size: 1.2rem; }    /* 18px */
  .text-2xl { font-size: 1.333rem; } /* 20px */
  .text-3xl { font-size: 1.6rem; }   /* 24px */
}
```

### 3.3 Touch-Friendly Text

```css
/* Minimum touch target text */
.touch-text {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 8px 0;
}

/* Interactive text links */
.touch-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 8px 12px;
  margin: -8px -12px;
  border-radius: 8px;
  transition: background 0.15s ease;
}

.touch-link:active {
  background: var(--muted);
}
```

### 3.4 Input Font Sizing (iOS Zoom Prevention)

```css
/* CRITICAL: 16px minimum prevents iOS auto-zoom on focus */
input[type="text"],
input[type="email"],
input[type="password"],
input[type="tel"],
input[type="number"],
textarea,
select {
  font-size: 16px !important;
  -webkit-text-size-adjust: 100%;
}
```

---

## 4. Layout Patterns

### 4.1 Bottom Sheet Modals

Native Telegram feel using bottom sheets instead of centered modals.

```css
/* Bottom sheet base */
.bottom-sheet {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: oklch(0 0 0 / 0.6);
  backdrop-filter: blur(4px);
}

.bottom-sheet-content {
  width: 100%;
  max-height: 90vh;
  max-height: calc(var(--tg-vh, 90vh) - 60px);
  background: var(--background);
  border-radius: 24px 24px 0 0;
  overflow: hidden;
  animation: slideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

/* Drag handle indicator */
.bottom-sheet-handle {
  width: 36px;
  height: 4px;
  background: var(--muted-foreground);
  border-radius: 2px;
  margin: 12px auto 8px;
  opacity: 0.3;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* Content with scroll */
.bottom-sheet-scroll {
  max-height: calc(90vh - 100px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 0 16px 24px;
}
```

### 4.2 Fixed Bottom CTA with Safe Area

```css
/* Fixed bottom bar pattern */
.fixed-bottom-cta {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  background: var(--background);
  border-top: 1px solid var(--border);
  z-index: 50;

  /* Glassmorphism variant */
  background: oklch(0.16 0.035 350 / 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

/* Content padding to account for fixed bottom */
.content-with-bottom-cta {
  padding-bottom: calc(80px + env(safe-area-inset-bottom, 0));
}
```

### 4.3 Compact Card Layouts

```css
/* Telegram-optimized card grid */
.twa-card-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 12px;
}

/* Compact avatar card */
.twa-avatar-card {
  position: relative;
  aspect-ratio: 4/5;
  border-radius: 12px;
  overflow: hidden;
  background: var(--muted);
}

.twa-avatar-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Card overlay for status/actions */
.twa-card-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, oklch(0 0 0 / 0.7) 0%, transparent 50%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 10px;
}

.twa-card-title {
  font-size: 13px;
  font-weight: 600;
  color: white;
  line-height: 1.2;
}

.twa-card-status {
  font-size: 11px;
  color: oklch(0.85 0.02 0);
  margin-top: 2px;
}
```

### 4.4 Swipe Gestures

```css
/* Horizontal scroll container for swipeable content */
.swipe-container {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
  gap: 12px;
  padding: 0 16px;
}

.swipe-container::-webkit-scrollbar {
  display: none;
}

.swipe-item {
  flex: 0 0 auto;
  scroll-snap-align: start;
  width: calc(100vw - 48px); /* Full width minus padding */
}

/* Smaller swipe items (e.g., tier cards) */
.swipe-item-compact {
  width: calc(50vw - 24px);
}

/* Swipe indicator dots */
.swipe-indicators {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 12px 0;
}

.swipe-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--muted-foreground);
  opacity: 0.3;
  transition: opacity 0.2s, width 0.2s;
}

.swipe-dot.active {
  opacity: 1;
  width: 18px;
  border-radius: 3px;
  background: var(--primary);
}
```

---

## 5. Component Adaptations

### 5.1 Buttons - Enhanced Touch Targets

**Web Button vs Telegram Adaptation:**

| Property | Web | Telegram WebApp |
|----------|-----|-----------------|
| Min Height | 48px | 52px |
| Min Touch Area | 44x44px | 52x52px |
| Border Radius | 14px | 16px |
| Padding | 12px 20px | 14px 24px |
| Font Weight | 500 | 600 |

```css
/* Premium button - Telegram optimized */
.btn-premium {
  position: relative;
  min-height: 52px;
  padding: 14px 24px;
  font-weight: 600;
  letter-spacing: 0.01em;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--primary) 0%, oklch(0.65 0.18 340) 100%);
  color: var(--primary-foreground);

  /* Neon glow effect */
  box-shadow:
    0 0 0 1px oklch(0.80 0.18 350 / 0.4),
    0 4px 20px oklch(0.70 0.16 350 / 0.4),
    inset 0 1px 0 oklch(1 0 0 / 0.12);

  /* Touch optimization */
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;

  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

/* Active state with haptic feedback trigger */
.btn-premium:active {
  transform: scale(0.98);
  box-shadow:
    0 0 0 1px oklch(0.75 0.18 350 / 0.5),
    0 2px 10px oklch(0.70 0.16 350 / 0.35);
}

/* Ghost button (icon only) */
.btn-ghost {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: transparent;
  color: var(--muted-foreground);
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.btn-ghost:active {
  background: var(--muted);
  transform: scale(0.95);
}
```

**TypeScript - Button with Haptic:**

```typescript
interface TelegramButtonProps {
  children: React.ReactNode
  onClick: () => void
  hapticType?: 'light' | 'medium' | 'heavy'
  disabled?: boolean
}

function TelegramButton({ children, onClick, hapticType = 'light', disabled }: TelegramButtonProps) {
  const { hapticImpact } = useAuth()

  const handleClick = () => {
    if (disabled) return
    hapticImpact(hapticType)
    onClick()
  }

  return (
    <button
      className="btn-premium w-full"
      onClick={handleClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
```

### 5.2 Cards - Compact with Swipe Actions

```css
/* Compact card for Telegram */
.twa-card {
  position: relative;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  touch-action: manipulation;
}

.twa-card:active {
  transform: scale(0.98);
  transition: transform 0.1s ease;
}

/* Card with swipe delete */
.twa-card-swipeable {
  position: relative;
  overflow: hidden;
}

.twa-card-swipeable .delete-action {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 80px;
  background: var(--destructive);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transform: translateX(100%);
  transition: transform 0.2s ease;
}

.twa-card-swipeable.swiped .delete-action {
  transform: translateX(0);
}
```

### 5.3 Modals - Bottom Sheets

```typescript
// Bottom sheet modal component pattern
interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  const { hapticImpact } = useAuth()

  const handleClose = () => {
    hapticImpact('light')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="bottom-sheet" onClick={handleClose}>
      <div
        className="bottom-sheet-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="bottom-sheet-handle" />

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 pb-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button className="btn-ghost" onClick={handleClose}>
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="bottom-sheet-scroll modal-content-safe">
          {children}
        </div>
      </div>
    </div>
  )
}
```

### 5.4 Navigation - BackButton Integration

```typescript
// Navigation pattern with Telegram BackButton
function useBackButton(onBack: () => void, enabled: boolean = true) {
  const { hapticImpact } = useAuth()

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg?.BackButton) return

    if (enabled) {
      const handleBackClick = () => {
        hapticImpact('light')
        onBack()
      }

      tg.BackButton.onClick(handleBackClick)
      tg.BackButton.show()

      return () => {
        tg.BackButton.offClick(handleBackClick)
        tg.BackButton.hide()
      }
    } else {
      tg.BackButton.hide()
    }
  }, [enabled, onBack, hapticImpact])
}

// Usage in view
function UploadView({ onBack }: { onBack: () => void }) {
  useBackButton(onBack, true)

  return (
    <div className="twa-view">
      {/* No custom back button needed - Telegram provides it */}
      <h1>Upload Photos</h1>
      {/* ... */}
    </div>
  )
}
```

### 5.5 Forms - Native Keyboard Handling

```css
/* Form container adjusts for keyboard */
.twa-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  padding-bottom: 24px;
}

/* Input with proper mobile sizing */
.twa-input {
  width: 100%;
  min-height: 52px;
  padding: 14px 16px;
  font-size: 16px; /* Prevents iOS zoom */
  background: var(--input);
  border: 2px solid var(--border);
  border-radius: 14px;
  color: var(--foreground);
  -webkit-appearance: none;
  appearance: none;
}

.twa-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 4px oklch(0.70 0.16 350 / 0.15);
}

/* Input with icon */
.twa-input-group {
  position: relative;
}

.twa-input-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted-foreground);
  pointer-events: none;
}

.twa-input-group .twa-input {
  padding-left: 48px;
}
```

**Input Type Optimizations:**

```typescript
// Use appropriate input types for mobile keyboards
<input
  type="email"
  inputMode="email"
  autoComplete="email"
  autoCapitalize="none"
  autoCorrect="off"
  spellCheck="false"
/>

<input
  type="tel"
  inputMode="tel"
  autoComplete="tel"
/>

<input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
/>
```

---

## 6. Telegram-Specific Features

### 6.1 MainButton Usage

The MainButton is Telegram's native fixed-bottom CTA. Use sparingly for primary actions.

```typescript
interface MainButtonConfig {
  text: string
  color?: string
  textColor?: string
  isActive?: boolean
  isVisible?: boolean
}

function useMainButton(config: MainButtonConfig, onClick: () => void) {
  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg?.MainButton) return

    const { text, color, textColor, isActive = true, isVisible = true } = config

    tg.MainButton.setParams({
      text,
      color: color || undefined,
      text_color: textColor || undefined,
      is_active: isActive,
      is_visible: isVisible,
    })

    tg.MainButton.onClick(onClick)

    if (isVisible) {
      tg.MainButton.show()
    }

    return () => {
      tg.MainButton.offClick(onClick)
      tg.MainButton.hide()
    }
  }, [config, onClick])
}

// Usage
function PaymentView({ onPay }: { onPay: () => void }) {
  useMainButton(
    { text: 'Оплатить 999 руб', isActive: true },
    onPay
  )

  // Or show progress during processing
  const showProgress = () => {
    window.Telegram?.WebApp?.MainButton?.showProgress(true)
  }

  return <div>...</div>
}
```

**MainButton Guidelines:**

| Use Case | Recommendation |
|----------|----------------|
| Payment confirmation | Yes - use MainButton |
| Primary CTA (single action) | Yes - consider MainButton |
| Multiple CTAs on screen | No - use custom buttons |
| Form submission | Maybe - depends on flow |
| Navigation | No - use custom or BackButton |

### 6.2 BackButton Integration

Already covered in Component Adaptations. Key patterns:

```typescript
// Hook for BackButton management
function useBackButton(onBack: () => void, enabled: boolean = true)

// Auto-show for non-root views
const showBackButton = viewState.view !== 'DASHBOARD' && viewState.view !== 'ONBOARDING'
```

### 6.3 HapticFeedback Patterns

PinGlass uses haptic feedback to enhance touch interactions.

```typescript
// From useAuth.ts - Haptic feedback helpers
const hapticImpact = useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') => {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style)
  } catch { /* silent fail on non-Telegram */ }
}, [])

const hapticNotification = useCallback((type: 'success' | 'error' | 'warning') => {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type)
  } catch { /* silent fail on non-Telegram */ }
}, [])

const hapticSelection = useCallback(() => {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged()
  } catch { /* silent fail on non-Telegram */ }
}, [])
```

**Haptic Feedback Usage Guide:**

| Action | Haptic Type | Style/Type |
|--------|------------|------------|
| Button tap | `impactOccurred` | `light` |
| Important button tap | `impactOccurred` | `medium` |
| Destructive action | `impactOccurred` | `heavy` |
| Selection change (radio, checkbox) | `selectionChanged` | - |
| Success (payment, generation complete) | `notificationOccurred` | `success` |
| Error (failed action) | `notificationOccurred` | `error` |
| Warning (validation) | `notificationOccurred` | `warning` |
| Pull-to-refresh | `impactOccurred` | `soft` |
| Card drag | `impactOccurred` | `rigid` |

### 6.4 Telegram Stars Payment Flow

```typescript
// Stars payment integration
async function initiateStarsPayment(tier: PricingTier) {
  const tg = window.Telegram?.WebApp
  if (!tg) throw new Error('Not in Telegram')

  // Create invoice via API
  const response = await fetch('/api/payment/stars/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegramUserId: tg.initDataUnsafe?.user?.id,
      tierId: tier.id,
    }),
  })

  const { invoiceLink } = await response.json()

  // Open Telegram payment interface
  tg.openInvoice(invoiceLink, (status) => {
    if (status === 'paid') {
      hapticNotification('success')
      // Navigate to results
    } else if (status === 'cancelled') {
      hapticNotification('warning')
    } else if (status === 'failed') {
      hapticNotification('error')
    }
  })
}
```

**Payment UI Pattern:**

```
Payment Modal (Bottom Sheet)
├── Tier Summary Card
│   ├── Photo count icon
│   ├── Price display
│   └── Per-photo calculation
├── Primary Payment (T-Bank)
│   └── [btn-premium] Оплатить 999 руб
├── Divider "или"
└── Alternative Payments
    ├── [btn-stars] 150 Stars
    └── [btn-ton] ~0.5 TON
```

### 6.5 Expand/Close Behavior

```typescript
// Auto-expand on mount
useEffect(() => {
  const tg = window.Telegram?.WebApp
  if (!tg) return

  // Expand to full height
  tg.expand()

  // Mark as ready (removes loading state)
  tg.ready()

  // Enable closing confirmation for important flows
  if (viewState.view === 'GENERATING') {
    tg.enableClosingConfirmation()
    return () => tg.disableClosingConfirmation()
  }
}, [viewState.view])

// Programmatic close
function closeApp() {
  const tg = window.Telegram?.WebApp
  tg?.close()
}
```

### 6.6 Native Dialogs

```typescript
// Use Telegram's native dialogs for better UX
function showConfirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const tg = window.Telegram?.WebApp

    if (tg?.showConfirm) {
      tg.showConfirm(message, (confirmed) => {
        resolve(confirmed)
      })
    } else {
      resolve(window.confirm(message))
    }
  })
}

function showAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    const tg = window.Telegram?.WebApp

    if (tg?.showAlert) {
      tg.showAlert(message, () => resolve())
    } else {
      alert(message)
      resolve()
    }
  })
}

// Popup with custom buttons
function showPopup(params: {
  title?: string
  message: string
  buttons?: Array<{ id?: string; type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'; text?: string }>
}): Promise<string> {
  return new Promise((resolve) => {
    const tg = window.Telegram?.WebApp

    if (tg?.showPopup) {
      tg.showPopup(params, (buttonId) => {
        resolve(buttonId)
      })
    } else {
      // Fallback to basic confirm
      const confirmed = window.confirm(params.message)
      resolve(confirmed ? 'ok' : 'cancel')
    }
  })
}
```

---

## 7. Screen Inventory (Mobile-First)

### 7.1 Onboarding (Simplified)

**Layout:** Single scroll view, minimal steps

```
┌────────────────────────────────┐
│       [Telegram BackButton]   │ ← Hidden on first screen
├────────────────────────────────┤
│                                │
│    ┌────────────────────┐      │
│    │    Orbital Demo    │      │
│    │    (simplified)    │      │ ← Reduced animation complexity
│    └────────────────────┘      │
│                                │
│        🌸 PinGlass             │
│    Создавайте AI-фото          │
│                                │
│    ● ○ ○  (step indicators)    │
│                                │
├────────────────────────────────┤
│ ┌────────────────────────────┐ │
│ │    [Начать] btn-premium    │ │
│ └────────────────────────────┘ │
│         safe-area-bottom       │
└────────────────────────────────┘
```

**Key Adaptations:**
- Simplified orbital animation (fewer particles)
- Larger touch targets for swipe navigation
- Skip option visible early
- Single-tap to advance
- 2-3 steps max (vs. 3-4 on web)

### 7.2 Dashboard (2-Column Grid)

**Layout:** Fixed header, scrollable grid, fixed bottom CTA

```
┌────────────────────────────────┐
│ 🌸 PinGlass        [Settings]  │ ← Fixed header
├────────────────────────────────┤
│                                │
│  ┌──────────┐ ┌──────────┐     │
│  │    +     │ │   IMG    │     │
│  │  Новый   │ │  Avatar1 │     │
│  │  аватар  │ │  Ready●  │     │
│  └──────────┘ └──────────┘     │
│                                │
│  ┌──────────┐ ┌──────────┐     │
│  │   IMG    │ │   IMG    │     │
│  │  Avatar2 │ │  Avatar3 │     │
│  │  Proc●   │ │  Draft●  │     │
│  └──────────┘ └──────────┘     │
│                                │
│  (scrollable)                  │
│                                │
├────────────────────────────────┤
│ ┌────────────────────────────┐ │
│ │[Реферальная программа] btn │ │ ← Optional secondary CTA
│ └────────────────────────────┘ │
└────────────────────────────────┘
```

**Grid Specs:**
```css
.twa-dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 12px;
}
```

### 7.3 Upload (Camera Integration)

**Layout:** Tips collapsible, 3-column photo grid

```
┌────────────────────────────────┐
│ ←  │  Avatar Name  │  5/8 ✓   │
│     └──────────────┘  ████░░   │
├────────────────────────────────┤
│                                │
│  ┌────────────────────────────┐│
│  │ 📷 Советы        [Скрыть] ││ ← Collapsible tips
│  │ • Хорошее освещение       ││
│  └────────────────────────────┘│
│                                │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐  │
│  │ +  │ │IMG │ │IMG │ │IMG │  │
│  │    │ │ × │ │ × │ │ × │  │
│  └────┘ └────┘ └────┘ └────┘  │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐  │
│  │░░░ │ │░░░ │ │░░░ │ │░░░ │  │
│  └────┘ └────┘ └────┘ └────┘  │
│                                │
├────────────────────────────────┤
│ ┌────────────────────────────┐ │
│ │   ✨ Продолжить             │ │
│ └────────────────────────────┘ │
│ Нужно ещё 2 фото               │
└────────────────────────────────┘
```

**Camera Hint:**

```typescript
// Suggest camera for upload
<input
  type="file"
  accept="image/*"
  capture="environment" // or "user" for selfie
  multiple
/>
```

### 7.4 Payment (Stars Primary)

In Telegram WebApp, Stars payment is highlighted as primary.

```
┌────────────────────────────────┐
│ ←       Оформление             │
├────────────────────────────────┤
│                                │
│  ┌────────────────────────────┐│
│  │  Standard • 15 фото        ││
│  │  999 ₽ / 150 ⭐            ││
│  └────────────────────────────┘│
│                                │
│  ┌────────────────────────────┐│
│  │ ⭐ Оплатить 150 Stars      ││ ← PRIMARY in Telegram
│  └────────────────────────────┘│
│                                │
│  ──────── или ────────         │
│                                │
│  ┌────────────┐ ┌────────────┐ │
│  │ 💳 Карта   │ │ 💎 TON     │ │
│  │   999 ₽    │ │  ~0.5 TON  │ │
│  └────────────┘ └────────────┘ │
│                                │
└────────────────────────────────┘
```

### 7.5 Results (Swipe Gallery)

**Layout:** Fullscreen gallery with swipe navigation

```
┌────────────────────────────────┐
│ ←         5/15 фото            │
├────────────────────────────────┤
│                                │
│  ┌────────────────────────────┐│
│  │                            ││
│  │                            ││
│  │      FULL-WIDTH IMAGE      ││
│  │      (swipeable)           ││
│  │                            ││
│  │                            ││
│  └────────────────────────────┘│
│                                │
│      ○ ○ ○ ● ○ ○ ○ ○          │ ← Dot indicators
│                                │
├────────────────────────────────┤
│ ┌────────┐ ┌──────────────────┐│
│ │ ⬇ Save │ │  Все фото ▸      ││
│ └────────┘ └──────────────────┘│
└────────────────────────────────┘
```

**Swipe Gallery Component:**

```typescript
function SwipeGallery({ photos }: { photos: string[] }) {
  const [current, setCurrent] = useState(0)
  const { hapticSelection } = useAuth()

  const handleSwipe = (direction: 'left' | 'right') => {
    hapticSelection()
    if (direction === 'left' && current < photos.length - 1) {
      setCurrent(current + 1)
    } else if (direction === 'right' && current > 0) {
      setCurrent(current - 1)
    }
  }

  return (
    <div className="swipe-container">
      {photos.map((photo, index) => (
        <div
          key={index}
          className="swipe-item"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          <img src={photo} alt={`Photo ${index + 1}`} />
        </div>
      ))}
    </div>
  )
}
```

---

## 8. Performance Considerations

### 8.1 Reduced Animations

Telegram WebApps run in a WebView with limited GPU resources.

```css
/* Simplified animations for Telegram */
@media (max-width: 767px) {
  /* Reduce orbital animation complexity */
  .animate-orbit-smooth {
    animation-duration: 30s; /* Slower = less CPU */
  }

  /* Simplified neon effects */
  .animate-neon-flicker {
    animation: none;
    box-shadow: 0 0 8px oklch(0.70 0.20 350 / 0.5);
  }

  /* Reduce holographic border animation */
  @keyframes holographic-border {
    0%, 100% {
      border-color: oklch(0.75 0.18 350);
      box-shadow: 0 0 15px oklch(0.70 0.20 350 / 0.3);
    }
    50% {
      border-color: oklch(0.85 0.12 80);
      box-shadow: 0 0 15px oklch(0.80 0.15 80 / 0.3);
    }
  }

  /* Disable complex shadows during animation */
  .btn-premium:active {
    box-shadow: 0 0 0 1px var(--primary);
  }
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .animate-holographic-border,
  .animate-neon-flicker,
  .animate-orbit-smooth {
    animation: none;
  }
}
```

### 8.2 Image Optimization

```typescript
// Optimized image loading for Telegram
interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  priority?: boolean
}

function OptimizedImage({ src, alt, width, height, priority }: OptimizedImageProps) {
  // Use smaller images in Telegram WebApp
  const isTelegram = !!window.Telegram?.WebApp

  const optimizedSrc = useMemo(() => {
    if (isTelegram && src.includes('cloudflare-r2')) {
      // Request smaller variant
      return `${src}?w=${width || 400}&q=80&f=webp`
    }
    return src
  }, [src, width, isTelegram])

  return (
    <img
      src={optimizedSrc}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className="object-cover"
    />
  )
}
```

**Image Size Guidelines:**

| Context | Max Width | Format | Quality |
|---------|-----------|--------|---------|
| Avatar thumbnail | 200px | WebP | 75% |
| Gallery preview | 400px | WebP | 80% |
| Full gallery view | 800px | WebP | 85% |
| Onboarding demo | 300px | WebP | 70% |

### 8.3 Lazy Loading Patterns

```typescript
// Intersection Observer for lazy loading
function useLazyLoad<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '100px' }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}

// Usage in gallery
function LazyPhoto({ photo }: { photo: Photo }) {
  const { ref, isVisible } = useLazyLoad<HTMLDivElement>()

  return (
    <div ref={ref} className="photo-grid-item">
      {isVisible ? (
        <OptimizedImage src={photo.url} alt={photo.name} />
      ) : (
        <div className="skeleton aspect-square" />
      )}
    </div>
  )
}
```

### 8.4 Memory Management

```typescript
// Clean up resources when Mini App goes background
useEffect(() => {
  const tg = window.Telegram?.WebApp
  if (!tg) return

  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Pause heavy operations
      pauseAnimations()
      clearImageCache()
    } else {
      // Resume
      resumeAnimations()
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}, [])
```

### 8.5 Network Optimization

```typescript
// Detect connection quality
function useNetworkQuality() {
  const [quality, setQuality] = useState<'fast' | 'slow' | 'unknown'>('unknown')

  useEffect(() => {
    const connection = (navigator as any).connection

    if (connection) {
      const updateQuality = () => {
        const { effectiveType, downlink } = connection
        if (effectiveType === '4g' && downlink > 5) {
          setQuality('fast')
        } else {
          setQuality('slow')
        }
      }

      updateQuality()
      connection.addEventListener('change', updateQuality)

      return () => connection.removeEventListener('change', updateQuality)
    }
  }, [])

  return quality
}

// Adjust image quality based on network
function useAdaptiveImageQuality() {
  const quality = useNetworkQuality()

  return useMemo(() => {
    switch (quality) {
      case 'fast': return 85
      case 'slow': return 60
      default: return 75
    }
  }, [quality])
}
```

### 8.6 Bundle Size Optimization

```typescript
// Dynamic imports for heavy components
const ResultsGallery = dynamic(() => import('@/components/results-gallery'), {
  loading: () => <div className="skeleton-grid" />,
  ssr: false,
})

const ReferralPanel = dynamic(() => import('@/components/referral-panel'), {
  loading: () => <div className="skeleton h-48" />,
  ssr: false,
})

// Conditional imports based on view
function PersonaApp() {
  const [showResults, setShowResults] = useState(false)

  return (
    <>
      {showResults && <ResultsGallery />}
    </>
  )
}
```

---

## Appendix A: CSS Custom Properties Reference

```css
/* Telegram WebApp specific properties */
:root {
  /* Viewport */
  --tg-vh: 100vh;

  /* Theme colors (set via JS from Telegram) */
  --tg-theme-bg-color: var(--background);
  --tg-theme-text-color: var(--foreground);
  --tg-theme-hint-color: var(--muted-foreground);
  --tg-theme-link-color: var(--primary);
  --tg-theme-button-color: var(--primary);
  --tg-theme-button-text-color: var(--primary-foreground);

  /* Safe areas */
  --safe-area-top: env(safe-area-inset-top, 0);
  --safe-area-bottom: env(safe-area-inset-bottom, 0);
  --safe-area-left: env(safe-area-inset-left, 0);
  --safe-area-right: env(safe-area-inset-right, 0);

  /* Telegram-specific spacing */
  --twa-padding: 12px;
  --twa-gap: 10px;
  --twa-radius: 16px;
}
```

---

## Appendix B: Testing Checklist

### Device Testing Matrix

| Device | Screen | Safe Area | Priority |
|--------|--------|-----------|----------|
| iPhone SE (3rd gen) | 375x667 | None | High |
| iPhone 12/13/14 | 390x844 | Top+Bottom | High |
| iPhone 14 Pro | 393x852 | Dynamic Island | High |
| iPhone 15 Pro Max | 430x932 | Dynamic Island | Medium |
| Samsung Galaxy S21 | 360x800 | Top only | High |
| Pixel 7 | 412x915 | Top only | Medium |
| iPad Mini | 744x1133 | None | Low |

### Telegram Client Testing

| Client | Platform | Priority |
|--------|----------|----------|
| Telegram iOS | iPhone | High |
| Telegram Android | Android | High |
| Telegram Desktop | macOS | Medium |
| Telegram Desktop | Windows | Medium |
| Telegram Web | Browser | Low |

### Functionality Checklist

- [ ] Theme sync (light/dark)
- [ ] Viewport height calculation
- [ ] BackButton integration
- [ ] Haptic feedback
- [ ] Stars payment flow
- [ ] Safe area padding
- [ ] Keyboard handling
- [ ] Swipe gestures
- [ ] Bottom sheet modals
- [ ] Image lazy loading
- [ ] Offline state handling
- [ ] Deep link handling (`start_param`)

---

## Appendix C: Related Documentation

- [PinGlass Screen Inventory](../shared/SCREEN_INVENTORY.md)
- [PinGlass Component Catalog](../shared/COMPONENT_CATALOG.md)
- [Color Tokens](../shared/colors/tokens.json)
- [Animation Tokens](../shared/animations/tokens.json)
- [Telegram WebApp API Reference](https://core.telegram.org/bots/webapps)
- [Telegram Mini Apps Guidelines](https://core.telegram.org/bots/webapps#design-guidelines)

---

**Document Maintainer:** PinGlass Design Team
**Review Cycle:** Monthly or on major Telegram SDK updates
