# PinGlass Web Design System v4.0

A comprehensive design system for PinGlass Web application, built on modern CSS standards with OKLCH color space, Tailwind CSS 4, and accessibility-first principles.

---

## Table of Contents

1. [Color System](#1-color-system)
2. [Typography](#2-typography)
3. [Spacing & Layout](#3-spacing--layout)
4. [Components Inventory](#4-components-inventory)
5. [Effects & Animations](#5-effects--animations)
6. [Screens Inventory](#6-screens-inventory)
7. [Accessibility](#7-accessibility)

---

## 1. Color System

### 1.1 Primary Palette (OKLCH)

PinGlass uses the OKLCH color space for perceptually uniform colors with consistent vibrancy across themes.

#### Light Theme: "Vibrant Coral"

| Token | OKLCH Value | Hex Fallback | Usage |
|-------|-------------|--------------|-------|
| `--background` | `oklch(0.99 0.002 0)` | `#FEFEFE` | Page background |
| `--foreground` | `oklch(0.20 0.02 350)` | `#2D2A2E` | Primary text |
| `--card` | `oklch(1 0 0)` | `#FFFFFF` | Card backgrounds |
| `--primary` | `oklch(0.48 0.22 15)` | `#B83232` | Primary actions (WCAG AA: 5.1:1) |
| `--primary-vibrant` | `oklch(0.68 0.22 15)` | `#FF6B6B` | Decorative only |
| `--secondary` | `oklch(0.96 0.015 350)` | `#F9F5F6` | Secondary backgrounds |
| `--muted` | `oklch(0.97 0.008 350)` | `#F7F4F5` | Muted elements |
| `--muted-foreground` | `oklch(0.38 0.02 350)` | `#5E5659` | Secondary text |
| `--accent` | `oklch(0.72 0.20 25)` | `#FF8A65` | Accent highlights |
| `--border` | `oklch(0.92 0.012 350)` | `#E8E3E4` | Borders |
| `--ring` | `oklch(0.48 0.22 15)` | `#B83232` | Focus rings |

#### Dark Theme: "Elegant Dark"

| Token | OKLCH Value | Hex Fallback | Usage |
|-------|-------------|--------------|-------|
| `--background` | `oklch(0.15 0.02 350)` | `#1C181A` | Page background |
| `--foreground` | `oklch(0.96 0.01 0)` | `#F5F3F4` | Primary text |
| `--card` | `oklch(0.18 0.025 350)` | `#231E21` | Card backgrounds |
| `--primary` | `oklch(0.70 0.20 15)` | `#FF7B7B` | Primary actions |
| `--secondary` | `oklch(0.22 0.03 350)` | `#2F282C` | Secondary backgrounds |
| `--muted` | `oklch(0.20 0.02 350)` | `#27222A` | Muted elements |
| `--muted-foreground` | `oklch(0.65 0.02 350)` | `#9E959A` | Secondary text |
| `--border` | `oklch(0.28 0.02 350)` | `#3D363A` | Borders |

### 1.2 Semantic Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--success` | `oklch(0.65 0.15 145)` | `oklch(0.68 0.15 145)` | Success states |
| `--warning` | `oklch(0.80 0.12 85)` | `oklch(0.82 0.12 85)` | Warning states |
| `--info` | `oklch(0.65 0.15 250)` | `oklch(0.68 0.15 250)` | Info states |
| `--destructive` | `oklch(0.55 0.20 25)` | `oklch(0.55 0.20 25)` | Error/Destructive |

### 1.3 Accent Colors

| Token | OKLCH Value | Hex Fallback | Usage |
|-------|-------------|--------------|-------|
| `--accent-purple` | `oklch(0.65 0.18 290)` | `#9B7BFF` | Referral, special actions |
| `--accent-purple-light` | `oklch(0.72 0.15 290)` | `#B39DFF` | Purple hover states |
| `--neon-pink` | - | `#FF1493` | Animated logo glow |

### 1.4 Chart Colors

```css
--chart-1: oklch(0.68 0.22 15);   /* Coral */
--chart-2: oklch(0.72 0.20 25);   /* Warm orange */
--chart-3: oklch(0.62 0.14 340);  /* Deep pink */
--chart-4: oklch(0.80 0.11 80);   /* Gold */
--chart-5: oklch(0.85 0.08 60);   /* Light amber */
```

### 1.5 Gradient Definitions

#### Primary Gradient (CTAs)
```css
background: linear-gradient(135deg, var(--primary) 0%, oklch(0.65 0.18 340) 100%);
```

#### Premium Button Gradient
```css
background: linear-gradient(135deg, var(--primary) 0%, oklch(0.65 0.18 340) 100%);
box-shadow:
  0 0 0 1px oklch(0.80 0.18 350 / 0.4),
  0 4px 20px oklch(0.70 0.16 350 / 0.4),
  0 8px 32px oklch(0.70 0.16 350 / 0.2);
```

#### Purple Gradient (Referral)
```css
background: linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-purple-light) 100%);
```

#### Mesh Gradient Background
```css
background:
  radial-gradient(at 20% 30%, oklch(0.30 0.08 350 / 0.5) 0%, transparent 50%),
  radial-gradient(at 80% 70%, oklch(0.25 0.06 340 / 0.4) 0%, transparent 50%),
  radial-gradient(at 50% 90%, oklch(0.35 0.07 360 / 0.3) 0%, transparent 50%),
  oklch(0.16 0.035 350);
```

#### Text Gradient (Pink-Yellow)
```css
.text-gradient-pink {
  background: linear-gradient(135deg, var(--primary) 0%, oklch(0.80 0.14 340) 50%, oklch(0.85 0.11 80) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## 2. Typography

### 2.1 Font Families

| Variable | Font Stack | Usage |
|----------|------------|-------|
| `--font-sans` | `Inter, system-ui, sans-serif` | Body text, UI elements |
| `--font-display` | `Playfair Display, Georgia, serif` | Headings, decorative |
| `--font-mono` | `JetBrains Mono, monospace` | Code, numbers |

**Note:** Fonts are loaded via `next/font/google` with:
- Subsets: `latin`, `cyrillic`
- Display: `swap`
- Preload: Only primary font (Inter)

### 2.2 Type Scale

| Name | Size | Line Height | Weight | Usage |
|------|------|-------------|--------|-------|
| `text-xs` | 12px | 1.4 | 400 | Badges, micro-copy |
| `text-sm` | 14px | 1.5 | 400-500 | Captions, secondary text |
| `text-base` | 16px | 1.6 | 400 | Body text |
| `text-lg` | 18px | 1.55 | 500-600 | Subtitles |
| `text-xl` | 20px | 1.5 | 600 | Section headings |
| `text-2xl` | 24px | 1.4 | 700 | Page titles |
| `text-3xl` | 30px | 1.3 | 700 | Hero text |
| `text-4xl` | 36px | 1.2 | 700 | Large display |

### 2.3 Text Styles

#### Heading 1 (Page Title)
```css
font-size: 1.5rem; /* 24px */
font-weight: 700;
line-height: 1.4;
color: var(--foreground);
```

#### Heading 2 (Section)
```css
font-size: 1.125rem; /* 18px */
font-weight: 600;
line-height: 1.55;
color: var(--foreground);
```

#### Body Text
```css
font-size: 1rem; /* 16px */
font-weight: 400;
line-height: 1.6;
color: var(--foreground);
```

#### Caption / Muted
```css
font-size: 0.875rem; /* 14px */
font-weight: 400;
line-height: 1.5;
color: var(--muted-foreground);
```

#### Micro Text (Badges)
```css
font-size: 0.75rem; /* 12px */
font-weight: 500;
letter-spacing: 0.02em;
text-transform: uppercase;
```

---

## 3. Spacing & Layout

### 3.1 Spacing Scale

Based on 4px base unit with Tailwind spacing utilities.

| Token | Value | Tailwind Class |
|-------|-------|----------------|
| `0` | 0px | `p-0`, `m-0` |
| `1` | 4px | `p-1`, `m-1` |
| `2` | 8px | `p-2`, `m-2` |
| `3` | 12px | `p-3`, `m-3` |
| `4` | 16px | `p-4`, `m-4` |
| `5` | 20px | `p-5`, `m-5` |
| `6` | 24px | `p-6`, `m-6` |
| `8` | 32px | `p-8`, `m-8` |
| `10` | 40px | `p-10`, `m-10` |
| `12` | 48px | `p-12`, `m-12` |
| `16` | 64px | `p-16`, `m-16` |
| `20` | 80px | `p-20`, `m-20` |
| `24` | 96px | `p-24`, `m-24` |

### 3.2 Border Radius Tokens

| Token | Value | Tailwind Class | Usage |
|-------|-------|----------------|-------|
| `--radius-sm` | 16px | `rounded-md` | Small inputs |
| `--radius-md` | 18px | `rounded-lg` | Buttons |
| `--radius-lg` | 20px | `rounded-xl` | Cards |
| `--radius-xl` | 24px | `rounded-2xl` | Modals |

**Base radius:** `--radius: 1.25rem (20px)`

### 3.3 Container Widths

```css
--container-max: 1440px;
```

#### Container Class
```css
.container-max {
  max-width: var(--container-max);
  margin: 0 auto;
  padding-left: 1rem;   /* 16px mobile */
  padding-right: 1rem;
}

@media (min-width: 768px) {
  padding-left: 2rem;   /* 32px tablet */
  padding-right: 2rem;
}

@media (min-width: 1024px) {
  padding-left: 3rem;   /* 48px desktop */
  padding-right: 3rem;
}
```

### 3.4 Grid System

#### Photo Grid
```css
.grid-photos {
  display: grid;
  grid-template-columns: repeat(3, 1fr);  /* Mobile: 3 cols */
  gap: 8px;
}

/* 480px+ */ grid-template-columns: repeat(4, 1fr); gap: 12px;
/* 768px+ */ grid-template-columns: repeat(5, 1fr); gap: 14px;
/* 1024px+ */ grid-template-columns: repeat(6, 1fr); gap: 16px;
```

#### Avatar Grid
```css
.grid-avatars {
  display: grid;
  grid-template-columns: repeat(2, 1fr);  /* Mobile: 2 cols */
  gap: 12px;
}

/* 640px+ */ grid-template-columns: repeat(3, 1fr); gap: 16px;
/* 768px+ */ gap: 20px;
/* 1024px+ */ grid-template-columns: repeat(4, 1fr); gap: 24px;
```

### 3.5 Breakpoints

| Name | Min Width | Typical Use |
|------|-----------|-------------|
| `sm` | 640px | Landscape phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large screens |

---

## 4. Components Inventory

### 4.1 Buttons

#### btn-premium (Primary CTA)
Premium button with neon glow effect for main actions.

**Dimensions:**
- Min height: 52px
- Padding: 14px 24px
- Border radius: 16px

**States:**
| State | Visual Changes |
|-------|----------------|
| Default | Gradient background, inner glow, subtle shadow |
| Hover | Lift (-1px), increased glow, brighter shadow |
| Active | Scale(0.98), compressed shadow |
| Focus | 3px white outline, offset 2px |
| Disabled | opacity: 0.5, cursor: not-allowed |

**Code:**
```css
.btn-premium {
  min-height: 52px;
  padding: 14px 24px;
  font-weight: 600;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--primary) 0%, oklch(0.65 0.18 340) 100%);
  box-shadow:
    0 0 0 1px oklch(0.80 0.18 350 / 0.4),
    0 4px 20px oklch(0.70 0.16 350 / 0.4),
    0 8px 32px oklch(0.70 0.16 350 / 0.2),
    inset 0 1px 0 oklch(1 0 0 / 0.12);
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
```

#### btn-secondary
Secondary button for less prominent actions.

**Dimensions:**
- Min height: 48px
- Padding: 12px 20px
- Border radius: 14px

**States:**
| State | Visual Changes |
|-------|----------------|
| Default | Muted background, border |
| Hover | Darker background, primary border |
| Active | Scale(0.98) |
| Focus | 3px ring with offset |

#### btn-ghost
Icon-only or minimal buttons.

**Dimensions:**
- Size: 44x44px
- Border radius: 12px

**States:**
| State | Visual Changes |
|-------|----------------|
| Default | Transparent background |
| Hover | Muted background, foreground color |
| Active | Darker bg, scale(0.95) |
| Focus | 3px ring |

#### btn-payment-alt
Alternative payment method buttons (Stars, TON).

**Dimensions:**
- Min height: 44px
- Padding: 10px 16px
- Border radius: 12px
- Flex: 1 (fills container)

**Variants:**
- `.btn-ton` - Blue gradient for TON
- `.btn-stars` - Purple gradient for Telegram Stars

#### Button Variants (Radix UI)

| Variant | Usage |
|---------|-------|
| `default` | Standard primary actions |
| `secondary` | Secondary actions |
| `destructive` | Delete, cancel actions |
| `outline` | Bordered button |
| `ghost` | Minimal, icon buttons |
| `link` | Text-only link style |
| `gradient` | CTA with gradient |
| `gradient-purple` | Referral actions |
| `success` | Positive actions |

**Sizes:**
| Size | Height | Padding |
|------|--------|---------|
| `sm` | 32px | 12px |
| `default` | 36px | 16px |
| `lg` | 48px | 24px |
| `xl` | 56px | 32px |
| `icon` | 36px | - |
| `icon-sm` | 32px | - |
| `icon-lg` | 40px | - |

---

### 4.2 Cards

#### card-premium
Standard premium card with hover effects.

**Styling:**
```css
.card-premium {
  background: linear-gradient(145deg, var(--card) 0%, oklch(0.19 0.038 350) 100%);
  border: 1px solid oklch(0.35 0.05 350 / 0.3);
  border-radius: 20px;
  box-shadow:
    0 0 0 1px oklch(0.35 0.05 350 / 0.1),
    0 4px 24px oklch(0 0 0 / 0.15),
    inset 0 1px 0 oklch(1 0 0 / 0.03);
}
```

**States:**
| State | Visual Changes |
|-------|----------------|
| Default | Subtle shadow, gradient bg |
| Hover | Lift (-2px), stronger shadow, brighter border |
| Active | Scale(0.985) |

#### card-premium-glow
Enhanced card with neon glow for featured items.

**Additional styling:**
```css
box-shadow:
  0 0 0 1px oklch(0.70 0.16 350 / 0.15),
  0 0 24px oklch(0.70 0.16 350 / 0.2),
  0 8px 32px oklch(0.70 0.16 350 / 0.18);
```

#### tier-card
Selectable pricing tier card with radio behavior.

**Dimensions:**
- Padding: 16px
- Border radius: 20px
- Border: 2px solid

**States:**
| State | Class | Visual |
|-------|-------|--------|
| Default | `.tier-card` | Card background |
| Selected | `.tier-card-selected` | Primary border, gradient bg, ring |
| Popular | `.tier-card-popular` | Glow shadow |
| Focus | `:focus-visible` | 3px ring |

#### avatar-card
Photo/persona display card.

**Dimensions:**
- Aspect ratio: 4/5
- Border radius: 16px

**Features:**
- Overlay gradient for text readability
- Delete button (visible on hover/always on mobile)
- Active scale effect

#### Composable Card (Radix UI)

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
    <CardAction>Action</CardAction>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
```

---

### 4.3 Inputs & Forms

#### input-premium
Premium styled input with focus states.

**Dimensions:**
- Min height: 52px
- Padding: 14px 16px
- Border radius: 14px
- Font size: 16px (prevents iOS zoom)

**States:**
| State | Visual |
|-------|--------|
| Default | Muted border |
| Focus | Primary border, 4px glow ring |
| Error | Destructive border, ring |
| Disabled | opacity: 0.5 |

**Code:**
```css
.input-premium {
  min-height: 52px;
  padding: 14px 16px;
  font-size: 16px;
  background: var(--input);
  border: 2px solid var(--border);
  border-radius: 14px;
}

.input-premium:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px oklch(0.70 0.16 350 / 0.15);
}
```

#### Input (Radix UI)
```css
height: 36px;
border-radius: 12px;
padding: 8px 16px;
shadow: var(--shadow-sm);
focus: primary border, 3px ring;
```

---

### 4.4 Badges

| Variant | Background | Usage |
|---------|------------|-------|
| `default` | Primary | Standard labels |
| `secondary` | Secondary | Subtle labels |
| `success` | Success green | Completed states |
| `warning` | Warning amber | Attention needed |
| `info` | Info blue | Information |
| `destructive` | Red | Errors, deletions |
| `popular` | Primary gradient | "Hot", "Popular" tags |
| `purple` | Accent purple | Special badges |
| `outline` | Transparent | Bordered badge |

**Common styling:**
```css
border-radius: 9999px;
padding: 2px 8px;
font-size: 12px;
font-weight: 500;
```

#### badge-featured (CSS)
```css
.badge-featured {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  background: linear-gradient(135deg, oklch(0.70 0.16 350 / 0.2), oklch(0.80 0.11 80 / 0.15));
  border: 1px solid oklch(0.70 0.16 350 / 0.3);
}
```

---

### 4.5 Modals / Dialogs

#### modal-slide (Bottom Sheet Mobile)
```css
.modal-slide {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;  /* Mobile: bottom sheet */
  background: oklch(0 0 0 / 0.6);
  backdrop-filter: blur(4px);
}

/* Desktop: centered */
@media (min-width: 640px) {
  align-items: center;
}
```

#### modal-content
```css
.modal-content {
  width: 100%;
  max-height: 90vh;
  background: var(--background);
  border-radius: 24px 24px 0 0;  /* Mobile */
  animation: slideUp 0.3s ease-out;
}

@media (min-width: 640px) {
  max-width: 480px;
  border-radius: 24px;
  animation: scaleIn 0.25s ease-out;
}
```

#### Safe Area Handling
```css
.modal-content-safe {
  padding-bottom: max(24px, calc(16px + env(safe-area-inset-bottom)));
}

.bottom-sheet-safe {
  padding-bottom: max(24px, calc(16px + env(safe-area-inset-bottom)));
}
```

---

### 4.6 Progress Indicators

#### progress-premium
```css
.progress-premium {
  height: 6px;
  background: var(--muted);
  border-radius: 3px;
}

.progress-premium-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary) 0%, oklch(0.80 0.11 80) 100%);
  transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
```

#### status-dot
```css
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot-ready {
  background: oklch(0.72 0.17 142);  /* Green */
  box-shadow: 0 0 8px oklch(0.72 0.17 142 / 0.5);
}

.status-dot-pending {
  background: oklch(0.80 0.15 85);  /* Yellow */
  animation: pulse-subtle 2s infinite;
}
```

---

### 4.7 Navigation Elements

#### bottom-bar
Fixed bottom action bar with safe area support.

```css
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  background: oklch(0.16 0.035 350 / 0.95);
  backdrop-filter: blur(20px);
  border-top: 1px solid var(--border);
  z-index: 50;
}
```

#### Back Button Pattern
```css
button {
  padding: 10px;
  border-radius: 12px;
  color: var(--muted-foreground);
}

button:hover {
  background: var(--muted);
  color: var(--foreground);
}

button:active {
  transform: scale(0.95);
}
```

---

## 5. Effects & Animations

### 5.1 Glassmorphism Styles

#### .glass (Standard)
```css
.glass {
  background: linear-gradient(145deg, oklch(0.20 0.04 350 / 0.65), oklch(0.18 0.038 350 / 0.55));
  backdrop-filter: blur(24px) saturate(1.5);
  border: 1px solid oklch(0.70 0.16 350 / 0.2);
  box-shadow:
    0 0 0 1px oklch(1 0 0 / 0.03),
    0 8px 32px oklch(0 0 0 / 0.2),
    inset 0 1px 0 oklch(1 0 0 / 0.05);
}
```

#### .glass-strong
```css
.glass-strong {
  background: linear-gradient(145deg, oklch(0.22 0.045 350 / 0.85), oklch(0.20 0.04 350 / 0.75));
  backdrop-filter: blur(32px) saturate(1.8);
  border: 1px solid oklch(0.70 0.16 350 / 0.25);
}
```

#### .glass-subtle
```css
.glass-subtle {
  background: linear-gradient(145deg, oklch(0.18 0.038 350 / 0.45), oklch(0.16 0.035 350 / 0.35));
  backdrop-filter: blur(16px) saturate(1.3);
  border: 1px solid oklch(0.70 0.16 350 / 0.12);
}
```

### 5.2 Shadow System

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.05)` | `0 1px 3px rgba(0,0,0,0.2)` | Subtle elevation |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | `0 4px 12px rgba(0,0,0,0.3)` | Cards, buttons |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.1)` | `0 8px 24px rgba(0,0,0,0.4)` | Modals, popovers |
| `--shadow-glow` | `0 4px 20px rgba(255,107,107,0.25)` | `0 4px 20px rgba(255,107,107,0.35)` | Primary CTA glow |

### 5.3 Hover Effects

#### hover-lift
```css
.hover-lift {
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.hover-lift:hover { transform: translateY(-2px); }
.hover-lift:active { transform: translateY(0) scale(0.98); }
```

#### hover-glow
```css
.hover-glow:hover {
  box-shadow: 0 0 20px oklch(0.70 0.16 350 / 0.3), 0 0 40px oklch(0.70 0.16 350 / 0.15);
}
```

#### hover-scale
```css
.hover-scale:hover { transform: scale(1.03); }
.hover-scale:active { transform: scale(0.98); }
```

#### active-press
```css
.active-press:active {
  transform: scale(0.96);
  opacity: 0.9;
}
```

### 5.4 Entrance Animations

#### fade-in-up
```css
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(30px) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.animate-fade-in-up { animation: fade-in-up 0.8s ease-out forwards; }
```

#### fade-in-scale
```css
@keyframes fade-in-scale {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}
.animate-fade-in-scale { animation: fade-in-scale 0.6s ease-out forwards; }
```

#### Modal Animations
```css
/* Mobile: slide up from bottom */
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* Desktop: scale in */
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
```

### 5.5 Neon / Glow Effects

#### holographic-border
```css
@keyframes holographic-border {
  0%, 100% {
    border-color: oklch(0.75 0.18 350);
    box-shadow: 0 0 25px oklch(0.70 0.20 350 / 0.7), 0 0 50px oklch(0.70 0.18 340 / 0.5);
  }
  25% { border-color: oklch(0.80 0.15 320); }
  50% { border-color: oklch(0.85 0.12 80); }
  75% { border-color: oklch(0.78 0.16 10); }
}
```

#### neon-flicker
```css
@keyframes neon-flicker {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 10px oklch(0.70 0.20 350), 0 0 20px oklch(0.70 0.18 350 / 0.8);
  }
  20%, 24%, 55% { opacity: 0.5; }
}
```

#### Logo Animations
```css
.pinglass-logo {
  animation: pinglass-neon-breathe 3s ease-in-out infinite;
}

@keyframes pinglass-neon-breathe {
  0%, 100% { filter: drop-shadow(0 0 8px var(--neon-pink)) drop-shadow(0 0 16px rgba(255, 20, 147, 0.5)); }
  50% { filter: drop-shadow(0 0 12px var(--neon-pink)) drop-shadow(0 0 24px rgba(255, 20, 147, 0.7)); }
}
```

### 5.6 Orbital Animation (Onboarding)

```css
@keyframes orbit-smooth {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-orbit-smooth {
  animation: orbit-smooth var(--orbit-duration, 25s) linear infinite;
}

/* Counter-rotate to keep items upright */
.animate-orbit-smooth .orbit-content {
  animation: counter-rotate var(--orbit-duration, 25s) linear infinite;
}
```

### 5.7 Skeleton Loading

```css
.skeleton {
  background: linear-gradient(90deg, var(--muted) 0%, oklch(0.28 0.045 350) 50%, var(--muted) 100%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 2s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 5.8 View Transitions

```css
@view-transition { navigation: auto; }

::view-transition-old(root) { animation: fade-out 0.3s ease; }
::view-transition-new(root) { animation: fade-in 0.3s ease; }

.view-enter { animation: view-enter 0.4s ease forwards; }
.view-exit { animation: view-exit 0.3s ease forwards; }
```

---

## 6. Screens Inventory

### 6.1 Onboarding Screen

**File:** `components/views/onboarding-view.tsx`

**Key Components:**
- Orbital photo animation (DEMO_PHOTOS)
- Animated PinGlass logo
- Stage-based reveal (stages 0-4)
- Auth modal (Google OAuth, Email/Password)

**States:**
| Stage | Elements Visible |
|-------|-----------------|
| 0 | Initial (nothing) |
| 1 | Background gradient |
| 2 | Orbital photos |
| 3 | Logo + tagline |
| 4 | CTA button |

**Key CSS Classes:**
- `.animate-orbit-smooth`
- `.animate-logo-breathe`
- `.pinglass-logo-wrapper`
- `.bg-gradient-mesh`

---

### 6.2 Dashboard Screen

**File:** `components/views/dashboard-view.tsx`

**Key Components:**
- Page title ("Moi avatary")
- Avatar grid (2-4 columns responsive)
- Empty state CTA card
- Pricing tier cards (3 columns)
- Skeleton loading state

**Layout:**
```
[Title + Subtitle]
[Avatar Grid / Empty State]
[Pricing Tiers Row]
```

**Key CSS Classes:**
- `.grid-avatars`
- `.card-premium`
- `.skeleton-card`
- `.skeleton-grid`
- `.hover-lift`

---

### 6.3 Upload Screen

**File:** `components/views/upload-view.tsx`

**Key Components:**
- Back button
- Photo upload grid (3-6 columns)
- Drag & drop zone
- Progress indicator
- Photo count display (5-8 required)

**Key CSS Classes:**
- `.grid-photos`
- `.photo-grid-item`
- `.btn-delete`
- `.progress-premium`

---

### 6.4 Tier Select Screen

**File:** `components/views/tier-select-view.tsx`

**Key Components:**
- Back button
- Tier radio group (WCAG compliant)
- Tier cards with selection state
- Popular/discount badges
- CTA button

**Accessibility:**
- `role="radiogroup"`
- Arrow key navigation
- Focus management
- `aria-label` attributes

**Key CSS Classes:**
- `.tier-card`
- `.tier-card-selected`
- `.tier-card-popular`
- `.badge-featured`

---

### 6.5 Generating Screen

**Key Components:**
- Progress card with glow
- Animated progress bar
- Status text
- "Can close" notification

**Key CSS Classes:**
- `.card-premium-glow`
- `.progress-premium`
- `.animate-pulse-glow`

---

### 6.6 Results Screen

**File:** `components/views/results-view.tsx`

**Key Components:**
- Generated photos gallery
- Download buttons
- "Generate More" CTA
- Share functionality

**Key CSS Classes:**
- `.grid-photos`
- `.avatar-card`
- `.btn-premium`

---

### 6.7 Payment Modal

**File:** `components/payment-modal.tsx`

**Key Components:**
- Tier selection (if not pre-selected)
- Payment method tabs (T-Bank, Stars, TON)
- Email input (for T-Bank)
- Price display with discounts
- Feature list
- Multi-step flow (FORM -> PROCESSING -> SUCCESS/ERROR)

**Steps:**
| Step | Display |
|------|---------|
| FORM | Tier selection, payment methods |
| PROCESSING | Loading spinner |
| REDIRECT | External redirect notice |
| STARS_WAITING | Polling for Stars payment |
| TON_PAYMENT | TON wallet connection |
| SUCCESS | Celebration animation |
| ERROR | Error message |

**Key CSS Classes:**
- `.modal-slide`
- `.modal-content`
- `.btn-premium`
- `.btn-payment-alt`
- `.payment-alt-row`
- `.payment-divider`

---

### 6.8 Referral Panel

**File:** `components/referral-panel.tsx`

**Key Components:**
- Referral code display
- Copy button
- Earnings display
- Partner status badge
- Invite link sharing

**Key CSS Classes:**
- `.btn-ghost`
- `.badge-featured` (variant: purple)
- `.text-gradient-pink-purple`

---

## 7. Accessibility

### 7.1 Touch Targets

**Minimum sizes (WCAG 2.5.5 AAA):**
| Element | Minimum Size |
|---------|--------------|
| Buttons | 44x44px |
| Large buttons | 52x52px |
| Icon buttons | 44x44px |
| Links | 44px height |
| Form inputs | 44px height |

**Implementation:**
```css
.touch-target {
  min-height: 44px;
  min-width: 44px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.touch-target-lg {
  min-height: 52px;
  min-width: 52px;
}
```

### 7.2 Color Contrast Ratios

| Element | Ratio | Standard |
|---------|-------|----------|
| Body text on background | 7.5:1 | AAA |
| Primary button text | 5.1:1 | AA |
| Muted text | 4.6:1 | AA |
| Interactive elements | 4.5:1+ | AA |
| Large text (18px+) | 3:1+ | AA |

**Verified tokens:**
- `--primary` (light): 5.1:1 on white
- `--muted-foreground` (light): 4.6:1 on background
- `--foreground` (dark): 14:1 on dark background

### 7.3 Keyboard Navigation

**Focus states:**
```css
:focus-visible {
  outline: 3px solid var(--ring);
  outline-offset: 2px;
}

/* High contrast focus for buttons */
.btn-premium:focus-visible {
  outline: 3px solid oklch(1 0 0 / 0.9);
  outline-offset: 2px;
  box-shadow: 0 0 0 3px var(--primary), 0 0 0 6px oklch(0.48 0.22 15 / 0.3);
}
```

**Radio group navigation:**
- Arrow keys: Move selection
- Enter/Space: Confirm selection
- Home: First option
- End: Last option

### 7.4 ARIA Patterns

#### Radio Group (Tier Selection)
```tsx
<div role="radiogroup" aria-label="Select package">
  <div
    role="radio"
    aria-checked={isSelected}
    tabIndex={isSelected ? 0 : -1}
  >
    ...
  </div>
</div>
```

#### Modal Dialog
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <h2 id="modal-title">Payment</h2>
</div>
```

#### Back Button
```tsx
<button aria-label="Back">
  <ArrowLeft />
</button>
```

#### Status Indicators
```tsx
<span
  role="status"
  aria-live="polite"
>
  Generating photos...
</span>
```

### 7.5 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .pinglass-logo,
  .animate-holographic-border,
  .animate-neon-flicker,
  .skeleton {
    animation: none;
    will-change: auto;
  }

  /* Provide static alternatives */
  .animate-holographic-border {
    box-shadow: 0 0 15px oklch(0.70 0.20 350 / 0.3);
    border-color: oklch(0.75 0.18 350);
  }
}
```

### 7.6 Viewport Scaling

```tsx
// layout.tsx
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // WCAG 2.1 - allow zoom
  userScalable: true, // Required for accessibility
}
```

### 7.7 Input Zoom Prevention (iOS)

```css
/* iOS requires 16px minimum to prevent auto-zoom */
input[type="text"],
input[type="email"],
input[type="password"],
textarea,
select {
  font-size: 16px !important;
}
```

### 7.8 Safe Area Support

```css
/* iPhone notch/Dynamic Island */
.safe-area-inset-top { padding-top: env(safe-area-inset-top, 0); }
.safe-area-inset-bottom { padding-bottom: env(safe-area-inset-bottom, 0); }

.fixed-bottom-safe {
  padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
}

.fullscreen-safe {
  padding: env(safe-area-inset-top, 0) env(safe-area-inset-right, 0)
           env(safe-area-inset-bottom, 0) env(safe-area-inset-left, 0);
}
```

### 7.9 Screen Reader Considerations

1. **Meaningful alt text** for all images
2. **Skip links** for keyboard navigation
3. **Announce dynamic content** with `aria-live`
4. **Clear error messages** associated with inputs
5. **Descriptive link text** (not "click here")

---

## Appendix: Design Tokens Reference

### Quick Reference Table

| Category | Token | CSS Variable |
|----------|-------|--------------|
| Primary Color | Coral | `var(--primary)` |
| Background | White/Dark | `var(--background)` |
| Card | Elevated surface | `var(--card)` |
| Border | Dividers | `var(--border)` |
| Muted | Subtle elements | `var(--muted)` |
| Accent | Highlights | `var(--accent)` |
| Radius | Base | `var(--radius)` |
| Font Sans | Inter | `var(--font-sans)` |
| Font Display | Playfair | `var(--font-display)` |
| Shadow SM | Subtle | `var(--shadow-sm)` |
| Shadow MD | Medium | `var(--shadow-md)` |
| Shadow Glow | Primary glow | `var(--shadow-glow)` |

---

**Version:** 4.0
**Last Updated:** 2026-01-17
**Maintained by:** PinGlass Design Team
