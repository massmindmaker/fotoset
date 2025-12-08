# React Components

## Overview

PinGlass uses React 19 with Next.js 16 App Router. All components are client-side rendered.

---

## PersonaApp

**File:** `components/persona-app.tsx` (414 lines)

Main application component managing all views and state.

### Exports

```typescript
export interface PricingTier {
  id: string
  photos: number
  price: number
  popular?: boolean
}

export const PRICING_TIERS: PricingTier[] = [
  { id: "starter", photos: 7, price: 499 },
  { id: "standard", photos: 15, price: 999, popular: true },
  { id: "premium", photos: 23, price: 1499 },
]

export default function PersonaApp()
```

### State

```typescript
const [viewState, setViewState] = useState<ViewState>({ view: "ONBOARDING" })
const [personas, setPersonas] = useState<Persona[]>([])
const [isGenerating, setIsGenerating] = useState(false)
const [generationProgress, setGenerationProgress] = useState(0)
const [isPro, setIsPro] = useState(false)
const [isPaymentOpen, setIsPaymentOpen] = useState(false)
const [deviceId, setDeviceId] = useState("")
const [isReady, setIsReady] = useState(false)
const [selectedTier, setSelectedTier] = useState<PricingTier>(PRICING_TIERS[1])
const [theme, setTheme] = useState<"dark" | "light">("dark")
```

### Types

```typescript
interface UploadedImage {
  id: string
  base64: string
  mimeType: string
  previewUrl: string
}

interface GeneratedAsset {
  id: string
  type: "PHOTO"
  url: string
  styleId: string
  prompt?: string
  createdAt: number
}

interface Persona {
  id: string
  name: string
  status: "draft" | "processing" | "ready"
  images: UploadedImage[]
  generatedAssets: GeneratedAsset[]
  thumbnailUrl?: string
}

type ViewState =
  | { view: "ONBOARDING" }
  | { view: "DASHBOARD" }
  | { view: "CREATE_PERSONA_UPLOAD"; personaId: string }
  | { view: "SELECT_TIER"; personaId: string }
  | { view: "GENERATING"; personaId: string; progress: number }
  | { view: "RESULTS"; personaId: string }
```

### Key Methods

| Method | Lines | Description |
|--------|-------|-------------|
| `getDeviceId()` | 37-42 | Get or create device ID from localStorage |
| `toggleTheme()` | 68-73 | Switch between dark/light mode |
| `completeOnboarding()` | 75 | Mark onboarding as complete |
| `handleCreatePersona()` | 76-80 | Create new persona and navigate to upload |
| `updatePersona()` | 81 | Update persona data |
| `deletePersona()` | 82-85 | Remove persona with confirmation |
| `getActivePersona()` | 86 | Get current persona from viewState |
| `handleGenerate()` | 88-102 | Start AI photo generation |
| `handlePaymentSuccess()` | 104 | Handle successful payment |

---

## Sub-Components (within PersonaApp)

### GeneratingView

**Lines:** 138-152

Progress indicator shown during AI generation.

```typescript
const GeneratingView: React.FC<{
  progress: number
  totalPhotos: number
}>
```

**Features:**
- Pulsing loader icon
- Progress bar with gradient
- Photo count indicator (X of Y)

---

### OnboardingView

**Lines:** 154-226

Animated welcome screen with orbiting photo gallery.

```typescript
const OnboardingView: React.FC<{
  onComplete: () => void
  onStart: () => void
}>
```

**Features:**
- 4-stage animated entrance (logo, inner orbit, outer orbit, text)
- Inner orbit: 4 photos rotating clockwise
- Outer orbit: 6 photos rotating counter-clockwise
- Holographic shine effects
- "Start" and "Skip" buttons

**Animation Stages:**
1. Stage 1 (100ms): Main image appears
2. Stage 2 (1200ms): Inner orbit (4 photos) enters
3. Stage 3 (1800ms): Outer orbit (6 photos) enters
4. Stage 4 (2400ms): Text and buttons fade in

---

### DashboardView

**Lines:** 228-280

Avatar gallery and pricing tiers display.

```typescript
const DashboardView: React.FC<{
  personas: Persona[]
  onCreate: () => void
  onSelect: (id: string) => void
  onDelete: (id: string, e: React.MouseEvent) => void
}>
```

**Features:**
- Empty state with create prompt and pricing tiers
- Persona grid with thumbnails
- Status badges (draft/ready with photo count)
- Delete button on hover
- Feature highlights (up to 23 photos, secure)

---

### UploadView

**Lines:** 282-328

Multi-file upload interface.

```typescript
const UploadView: React.FC<{
  persona: Persona
  updatePersona: (id: string, data: Partial<Persona>) => void
  onBack: () => void
  onNext: () => void
}>
```

**Features:**
- Editable persona name
- Progress bar (0-100% for 0-20 photos)
- Tips panel (lighting, angles, no accessories)
- Grid of uploaded photos with remove button
- Add more button
- Continue button (enabled when 10+ photos)
- Mobile-friendly fixed bottom bar

**Validation:**
- Minimum: 10 photos
- Maximum: 20 photos
- Accepted formats: image/*

---

### TierSelectView

**Lines:** 331-364

Pricing tier selection screen.

```typescript
const TierSelectView: React.FC<{
  persona: Persona
  onBack: () => void
  onGenerate: (tier: PricingTier) => void
  isGenerating: boolean
  isPro: boolean
  onUpgrade: (tier: PricingTier) => void
  selectedTier: PricingTier
  onSelectTier: (tier: PricingTier) => void
}>
```

**Tiers:**

| ID | Photos | Price | Description |
|----|--------|-------|-------------|
| starter | 7 | 499 RUB | Try AI photos |
| standard | 15 | 999 RUB | Optimal choice (popular) |
| premium | 23 | 1499 RUB | Maximum features |

**Features:**
- 3 tier cards with selection state
- Price per photo calculation
- "Popular" badge on standard tier
- Selected tier indicator
- Pro users: "Generate" button
- Non-Pro users: "Pay X RUB" button

---

### ResultsView

**Lines:** 366-414

Gallery of generated photos with download options.

```typescript
const ResultsView: React.FC<{
  persona: Persona
  onBack: () => void
  onGenerateMore: () => void
}>
```

**Features:**
- Desktop: Two-column layout
  - Left: Large selected photo with download
  - Right: Info card + thumbnail grid
- Mobile: Single column with photo grid
- Individual download buttons
- "Generate More" button
- Persona info card with photo count

---

## PaymentModal

**File:** `components/payment-modal.tsx` (323 lines)

Modal dialog for payment processing.

### Props

```typescript
interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  deviceId: string
  tier: PricingTier
}
```

### Features

- Tier selection (if opened from dashboard)
- Feature list per tier
- Payment button with T-Bank integration
- Loading and processing states
- Test mode support
- Payment status polling

---

## ThemeProvider

**File:** `components/theme-provider.tsx` (11 lines)

Dark mode theme provider wrapper.

### Props

```typescript
interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: "light" | "dark" | "system"
}
```

### Usage

```tsx
// app/layout.tsx
<ThemeProvider defaultTheme="dark">
  {children}
</ThemeProvider>
```

---

## Icons Used

From `lucide-react`:

| Icon | Usage |
|------|-------|
| `Sparkles` | Logo, AI indicator, generate buttons |
| `Plus` | Create new, add photos |
| `ArrowLeft` | Back navigation |
| `ArrowRight` | Next/continue |
| `Camera` | Tips section |
| `Loader2` | Loading spinner |
| `X` | Close/remove buttons |
| `CheckCircle2` | Selection indicator |
| `Download` | Download buttons |
| `User` | Avatar placeholder |
| `Zap` | Feature highlight |
| `Shield` | Security feature |
| `Star` | Popular badge |
| `ChevronRight` | Navigation arrow |
| `Lock` | Locked feature |
| `Crown` | Pro/payment indicator |
| `Sun` | Light mode |
| `Moon` | Dark mode |

---

## Styling Patterns

### Tailwind CSS 4 Classes

```tsx
// Card with glassmorphism
<div className="bg-card border border-border rounded-2xl shadow-lg">

// Primary button with gradient
<button className="bg-gradient-to-r from-primary to-accent text-white rounded-xl px-6 py-3">

// Secondary/muted button
<button className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground">

// Grid layouts
<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">

// Fixed bottom bar (mobile)
<div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t">
```

### CSS Variables (OKLCH)

```css
/* styles/globals.css */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.7 0.15 330);       /* Pink */
  --accent: oklch(0.65 0.2 300);        /* Purple */
  --muted: oklch(0.95 0 0);
  --border: oklch(0.9 0 0);
}

.dark {
  --background: oklch(0.12 0.01 270);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.75 0.15 330);
  --muted: oklch(0.2 0.01 270);
  --border: oklch(0.25 0.01 270);
}
```

---

## Component Communication

```
PersonaApp
    |
    +-- State lifted to top level
    |
    +-- Props passed down to sub-components
    |
    +-- Callbacks for actions
        |
        +-- OnboardingView
        |   +-- onComplete -> completeOnboarding()
        |   +-- onStart -> handleCreatePersona()
        |
        +-- DashboardView
        |   +-- onCreate -> handleCreatePersona()
        |   +-- onSelect -> setViewState(UPLOAD or RESULTS)
        |   +-- onDelete -> deletePersona()
        |
        +-- UploadView
        |   +-- updatePersona -> updatePersona()
        |   +-- onBack -> setViewState(DASHBOARD)
        |   +-- onNext -> setViewState(SELECT_TIER)
        |
        +-- TierSelectView
        |   +-- onBack -> setViewState(UPLOAD)
        |   +-- onGenerate -> handleGenerate()
        |   +-- onUpgrade -> setIsPaymentOpen(true)
        |
        +-- ResultsView
        |   +-- onBack -> setViewState(DASHBOARD)
        |   +-- onGenerateMore -> setViewState(SELECT_TIER)
        |
        +-- PaymentModal
            +-- onClose -> setIsPaymentOpen(false)
            +-- onSuccess -> handlePaymentSuccess()
```
