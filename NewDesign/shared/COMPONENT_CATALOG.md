# PinGlass Component Catalog

Complete catalog of all UI components with variants, states, and usage guidelines.

---

## 1. Buttons

### 1.1 Premium Button (`.btn-premium`)
Primary CTA button with gradient and glow effect.

```css
/* Specs */
Height: 52px
Border-radius: 16px
Background: linear-gradient(135deg, var(--primary) 0%, oklch(0.65 0.18 340) 100%)
Shadow: 0 4px 20px rgba(255, 107, 107, 0.25)
Font: 600 16px Outfit
```

**States:**
| State | Transform | Shadow | Opacity |
|-------|-----------|--------|---------|
| Default | none | glow | 1 |
| Hover | translateY(-1px) | glow-strong | 1 |
| Active | scale(0.98) | glow-reduced | 1 |
| Disabled | none | none | 0.5 |
| Loading | none | glow | 0.8 |

**Usage:**
```tsx
<Button variant="gradient" size="lg">
  <Sparkles className="mr-2 h-5 w-5" />
  Создать
</Button>
```

---

### 1.2 Secondary Button (`.btn-secondary`)
Secondary actions and cancel buttons.

```css
Height: 48px
Border-radius: 14px
Background: var(--muted)
Border: 1px solid var(--border)
Font: 500 15px Outfit
```

**Usage:**
```tsx
<Button variant="secondary">Отмена</Button>
```

---

### 1.3 Ghost Button (`.btn-ghost`)
Icon-only buttons for actions like close, delete.

```css
Size: 44x44px (touch target)
Background: transparent
Border-radius: 50%
```

**States:**
| State | Background |
|-------|------------|
| Default | transparent |
| Hover | var(--muted) |
| Active | scale(0.95) |

**Usage:**
```tsx
<Button variant="ghost" size="icon">
  <X className="h-5 w-5" />
</Button>
```

---

### 1.4 Payment Alt Buttons

#### Stars Button (`.btn-stars`)
```css
Background: linear-gradient(135deg, oklch(0.60 0.18 280), oklch(0.55 0.20 300))
Color: white
Height: 44px
```

#### TON Button (`.btn-ton`)
```css
Background: linear-gradient(135deg, oklch(0.58 0.15 230), oklch(0.52 0.16 220))
Color: white
Height: 44px
```

---

## 2. Cards

### 2.1 Premium Card (`.card-premium`)
Elevated card with subtle gradient and shadow.

```css
Background: linear-gradient(145deg, var(--card), var(--muted))
Border: 1px solid var(--border)
Border-radius: 20px
Shadow: var(--shadow-md)
Padding: 24px
```

**Hover State:**
```css
transform: translateY(-2px)
shadow: var(--shadow-lg)
```

---

### 2.2 Tier Card (`.tier-card`)
Selection card for pricing tiers (radio button behavior).

```
┌─────────────────────────────────────────┐
│ ┌──────┐                                │
│ │  15  │  15 фотографий     ⭐ Popular  │
│ │      │  Оптимальный выбор             │
│ └──────┘  999 ₽  •  67 ₽/фото      ✓   │
└─────────────────────────────────────────┘
```

**States:**
| State | Border | Background | Ring |
|-------|--------|------------|------|
| Default | muted | transparent | none |
| Hover | muted-foreground/30 | muted/30 | none |
| Selected | primary | gradient | ring-2 primary/20 |
| Focus | primary | - | outline-3px |

**A11y:** `role="radio"`, `aria-checked`, keyboard navigation

---

### 2.3 Avatar Card (MinimalCard)
Photo card for dashboard grid.

```
┌─────────────────┐
│                 │
│      IMAGE      │
│                 │
├─────────────────┤
│ Avatar Name     │
│ [Ready] ●       │
└─────────────────┘
```

**Aspect Ratio:** 4:5
**Hover:** scale(1.03), shadow increase
**Delete Button:** Top-right, opacity transition

**Status Badges:**
- Ready: `bg-success/10 text-success`
- Processing: `bg-info/10 text-info animate-pulse`
- Draft: `bg-warning/10 text-warning`

---

### 2.4 KPI Card (Admin)
Metric display card with icon, value, and trend.

```
┌──────────────────────┐
│ 👥 Users            │
│                      │
│       1,234         │
│    45 Pro users     │
│         ↑ 12%       │
└──────────────────────┘
```

**Color Variants:**
- Default (coral)
- Green (revenue)
- Blue (conversion)
- Purple/Yellow (generations)

---

## 3. Form Elements

### 3.1 Input (`.input-premium`)
```css
Height: 52px
Border-radius: 14px
Font-size: 16px (iOS zoom prevention)
Padding: 16px
Border: 1px solid var(--border)
```

**States:**
| State | Border | Shadow |
|-------|--------|--------|
| Default | border | none |
| Focus | primary | ring-2 |
| Error | destructive | none |
| Disabled | muted | none |

**With Icon:**
```tsx
<div className="relative">
  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
  <Input className="pl-12" placeholder="Email" />
</div>
```

---

### 3.2 Progress Bar
```css
Height: 12px (8px for compact)
Background: var(--muted)
Border-radius: full
```

**Indicator:**
```css
Background: linear-gradient(90deg, var(--primary), oklch(0.65 0.18 340))
Transition: width 0.5s ease-out
```

---

### 3.3 Checkbox & Toggle
Standard shadcn/ui components with theme colors.

---

## 4. Modals & Dialogs

### 4.1 Modal (Dialog)
```css
/* Backdrop */
Background: rgba(0, 0, 0, 0.6)
Backdrop-filter: blur(4px)

/* Content */
Background: var(--card)
Border-radius: 24px
Max-width: 420px (mobile: 100% - 32px)
Padding: 24px
Shadow: var(--shadow-xl)
```

**Animation:**
- Desktop: `scaleIn` (0.25s)
- Mobile: `slideUp` (0.3s) from bottom

---

### 4.2 Bottom Sheet (Mobile)
```css
Position: fixed bottom
Border-radius: 24px 24px 0 0
Max-height: 90vh
Safe-area-padding: bottom
```

**Drag Handle:**
```
   ────────
```

---

## 5. Badges

### 5.1 Status Badges
```tsx
<Badge variant="success">Ready</Badge>    // Green
<Badge variant="info">Processing</Badge>  // Blue + pulse
<Badge variant="warning">Draft</Badge>    // Amber
<Badge variant="destructive">Failed</Badge> // Red
```

### 5.2 Feature Badges
```tsx
<Badge variant="popular">
  <Star className="h-3 w-3 mr-1" />
  Popular
</Badge>

<Badge variant="purple">
  <Percent className="h-3 w-3 mr-1" />
  -20%
</Badge>
```

---

## 6. Navigation

### 6.1 Back Button
```tsx
<Button variant="ghost" size="icon" onClick={goBack}>
  <ArrowLeft className="h-5 w-5" />
</Button>
```

### 6.2 Tab Navigation (Admin)
```css
Border-bottom: 2px solid var(--border)
Active-indicator: 2px solid var(--primary)
Tab-padding: 12px 16px
```

### 6.3 Bottom Navigation (Mobile)
Fixed bottom bar with safe area padding.

---

## 7. Effects & Overlays

### 7.1 Glassmorphism

#### Standard Glass
```css
.glass {
  background: linear-gradient(145deg,
    oklch(0.20 0.04 350 / 0.65),
    oklch(0.18 0.035 350 / 0.55)
  );
  backdrop-filter: blur(24px) saturate(1.5);
  border: 1px solid oklch(0.70 0.16 350 / 0.2);
}
```

#### Strong Glass
```css
.glass-strong {
  backdrop-filter: blur(32px) saturate(1.8);
  background: oklch(0.22 0.045 350 / 0.85);
}
```

#### Subtle Glass
```css
.glass-subtle {
  backdrop-filter: blur(16px) saturate(1.3);
  background: oklch(0.18 0.038 350 / 0.45);
}
```

---

### 7.2 Neon Glow Effects

#### Text Glow
```css
.text-shadow-glow {
  text-shadow: 0 0 20px oklch(0.70 0.16 350 / 0.5);
}
```

#### Box Glow
```css
.shadow-glow {
  box-shadow: 0 4px 20px rgba(255, 107, 107, 0.25);
}
```

#### Neon Frame
```css
.neon-frame {
  box-shadow:
    0 0 10px oklch(0.70 0.16 350 / 0.5),
    0 0 20px oklch(0.70 0.16 350 / 0.3),
    inset 0 0 15px oklch(0.70 0.16 350 / 0.2);
  animation: neon-flicker 2.5s ease-in-out infinite;
}
```

---

### 7.3 Gradient Text
```css
.text-gradient-pink {
  background: linear-gradient(135deg, var(--primary), oklch(0.65 0.18 340));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.text-gradient-pink-yellow {
  background: linear-gradient(135deg, var(--primary), oklch(0.80 0.15 60));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## 8. Loading States

### 8.1 Skeleton
```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--muted) 25%,
    oklch(0.90 0.01 350) 50%,
    var(--muted) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 2s ease-in-out infinite;
}
```

### 8.2 Spinner
```tsx
<Loader2 className="h-5 w-5 animate-spin" />
```

### 8.3 Progress Indicator
Used in generating view with percentage text.

---

## 9. Icons (Lucide React)

### Common Icons
| Icon | Usage |
|------|-------|
| `ArrowLeft` | Back navigation |
| `X` | Close, delete |
| `Plus` | Add new |
| `Sparkles` | AI/Magic actions |
| `Camera` | Photo-related |
| `CreditCard` | Payments |
| `Star` | Popular, Stars |
| `Wallet` | Balance, TON |
| `CheckCircle` | Success |
| `AlertCircle` | Error |
| `Loader2` | Loading |
| `Download` | Download action |
| `Share2` | Share action |

### Size Standards
- Small: `h-4 w-4`
- Default: `h-5 w-5`
- Large: `h-6 w-6`
- XL: `h-8 w-8`

---

## 10. Animations

### 10.1 Entrance Animations
```css
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes fade-in-scale {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

### 10.2 Orbital Animations (Onboarding)
```css
@keyframes orbit-smooth {
  from { transform: rotate(0deg) translateX(var(--orbit-radius)) rotate(0deg); }
  to { transform: rotate(360deg) translateX(var(--orbit-radius)) rotate(-360deg); }
}
```

### 10.3 Hover Effects
```css
.hover-lift:hover {
  transform: translateY(-2px);
}

.hover-glow:hover {
  box-shadow: 0 8px 30px rgba(255, 107, 107, 0.35);
}

.hover-scale:hover {
  transform: scale(1.03);
}

.active-press:active {
  transform: scale(0.96);
}
```

### 10.4 Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 11. Responsive Patterns

### Breakpoints
| Name | Width | Usage |
|------|-------|-------|
| `sm` | 480px | Small phones → larger phones |
| `md` | 640px | Phones → tablets |
| `lg` | 768px | Tablets → small laptops |
| `xl` | 1024px | Laptops → desktops |
| `2xl` | 1280px | Large desktops |

### Container Padding
```css
padding-x: 1rem;      /* Mobile */
@media (min-width: 768px) { padding-x: 2rem; }
@media (min-width: 1024px) { padding-x: 3rem; }
```

### Grid Adaptations
```css
/* Photos grid */
grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6

/* Avatars grid */
grid-cols-2 sm:grid-cols-3 lg:grid-cols-4
```

---

## 12. Accessibility

### Touch Targets
```css
.touch-target {
  min-width: 44px;
  min-height: 44px;
}
```

### Focus States
```css
:focus-visible {
  outline: 3px solid var(--ring);
  outline-offset: 2px;
}
```

### Keyboard Navigation
- Tab: Focus order
- Enter/Space: Activate
- Arrows: Navigate within groups
- Escape: Close modals

### ARIA Patterns
- Modals: `aria-modal`, `aria-labelledby`
- Radio groups: `role="radiogroup"`, `aria-checked`
- Progress: `role="progressbar"`, `aria-valuenow`
- Live regions: `aria-live="polite"`

---

## Component Usage Examples

### Complete Button Row
```tsx
<div className="flex gap-3">
  <Button variant="gradient" size="lg" className="flex-1">
    <Sparkles className="mr-2 h-5 w-5" />
    Создать
  </Button>
  <Button variant="ghost" size="icon">
    <MoreHorizontal className="h-5 w-5" />
  </Button>
</div>
```

### Card with Badge
```tsx
<Card className="card-premium">
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>Premium Plan</CardTitle>
      <Badge variant="popular">
        <Star className="h-3 w-3 mr-1" />
        Popular
      </Badge>
    </div>
  </CardHeader>
  <CardContent>
    {/* ... */}
  </CardContent>
</Card>
```

### Form Group
```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <div className="relative">
    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
    <Input
      id="email"
      type="email"
      placeholder="your@email.com"
      className="pl-12"
    />
  </div>
</div>
```
