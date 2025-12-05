# React Components

## Overview

PinGlass uses React 19 with Next.js 16 App Router. All components are client-side rendered.

---

## PersonaApp

**File:** `components/persona-app.tsx` (1099 lines)

Main application component managing all views and state.

### Props

```typescript
// No props - standalone component
```

### State

```typescript
interface PersonaAppState {
  viewState: ViewState
  personas: Persona[]
  currentPersonaIndex: number
  isPro: boolean
  deviceId: string
  isReady: boolean
  onboardingStep: number
  generatingPhotos: boolean
  showPaymentModal: boolean
}

type ViewState =
  | 'ONBOARDING'
  | 'DASHBOARD'
  | 'CREATE_PERSONA_UPLOAD'
  | 'SELECT_STYLE'
  | 'GENERATING'
  | 'RESULTS'
```

### Types

```typescript
interface Persona {
  id: string
  name: string
  createdAt: Date
  uploadedImages: UploadedImage[]
  generatedAssets: GeneratedAsset[]
  selectedStyle: StylePreset | null
  status: 'draft' | 'processing' | 'ready'
}

interface UploadedImage {
  id: string
  file: File
  preview: string
}

interface GeneratedAsset {
  id: string
  url: string
  prompt: string
  style: string
}

interface StylePreset {
  id: 'professional' | 'lifestyle' | 'creative'
  name: string
  description: string
  thumbnail: string
}
```

### Key Methods

| Method | Description |
|--------|-------------|
| `handleUploadImages` | Process dropped/selected files |
| `handleRemoveImage` | Remove image from upload queue |
| `handleStyleSelect` | Set persona style |
| `handleGenerate` | Start photo generation |
| `handlePayment` | Open payment modal |
| `handleDownload` | Download generated photo |
| `handleDeletePersona` | Remove persona |

---

## Sub-Components (within PersonaApp)

### OnboardingView

**Lines:** 423-517

3-step tutorial carousel introducing the app.

```typescript
function OnboardingView({
  step,
  onNext,
  onSkip
}: {
  step: number
  onNext: () => void
  onSkip: () => void
})
```

**Features:**
- Step indicators (dots)
- Before/After image examples
- Skip button
- Next/Continue button

**Steps:**
1. Welcome - App introduction
2. Upload - How to upload photos
3. Results - What to expect

---

### DashboardView

**Lines:** 518-645

Grid view of all user personas.

```typescript
function DashboardView({
  personas,
  onCreateNew,
  onSelectPersona,
  onDeletePersona
}: {
  personas: Persona[]
  onCreateNew: () => void
  onSelectPersona: (index: number) => void
  onDeletePersona: (id: string) => void
})
```

**Features:**
- Persona cards with thumbnails
- Status badges (draft/processing/ready)
- Create new button (+ card)
- Delete confirmation

---

### UploadView

**Lines:** 646-792

Multi-file upload interface.

```typescript
function UploadView({
  images,
  onUpload,
  onRemove,
  onContinue,
  onBack
}: {
  images: UploadedImage[]
  onUpload: (files: FileList) => void
  onRemove: (id: string) => void
  onContinue: () => void
  onBack: () => void
})
```

**Features:**
- Drag-and-drop zone
- File input (multiple)
- Image previews with remove button
- 10-20 photo requirement indicator
- Continue/Back buttons

**Validation:**
- Minimum: 10 photos
- Maximum: 20 photos
- Accepted formats: JPEG, PNG, WebP

---

### StyleSelectView

**Lines:** 793-885

Style preset selection screen.

```typescript
function StyleSelectView({
  onSelect,
  onBack
}: {
  onSelect: (style: StylePreset) => void
  onBack: () => void
})
```

**Style Presets:**

| ID | Name | Description |
|----|------|-------------|
| `professional` | Professional | Business portraits, clean backgrounds |
| `lifestyle` | Lifestyle | Casual photos, natural locations |
| `creative` | Creative | Artistic shots, dramatic lighting |

**Features:**
- 3 style cards with thumbnails
- Descriptions and example images
- Back button

---

### GeneratingView

**Lines:** 390-422

Progress indicator during generation.

```typescript
function GeneratingView({
  progress,
  total
}: {
  progress: number
  total: number
})
```

**Features:**
- Spinning loader
- Progress counter (X/23)
- Status message
- "You can close this page" notice

---

### ResultsView

**Lines:** 886-1032

Gallery of generated photos.

```typescript
function ResultsView({
  photos,
  onDownload,
  onDownloadAll,
  onGenerateMore,
  onBack
}: {
  photos: GeneratedAsset[]
  onDownload: (photo: GeneratedAsset) => void
  onDownloadAll: () => void
  onGenerateMore: () => void
  onBack: () => void
})
```

**Features:**
- Photo grid (responsive)
- Individual download buttons
- Download all button
- Generate more button
- Back to dashboard

---

## PaymentModal

**File:** `components/payment-modal.tsx` (79 lines)

Modal dialog for Pro subscription purchase.

### Props

```typescript
interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onPay: () => void
  isLoading?: boolean
}
```

### Features

- Feature list (23 photos, all styles, download)
- Price display (500 ₽)
- Pay button
- Close button
- Loading state

### Usage

```tsx
<PaymentModal
  isOpen={showPaymentModal}
  onClose={() => setShowPaymentModal(false)}
  onPay={handlePayment}
  isLoading={paymentLoading}
/>
```

---

## ThemeProvider

**File:** `components/theme-provider.tsx` (11 lines)

Dark mode theme provider.

### Props

```typescript
interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: 'light' | 'dark' | 'system'
}
```

### Usage

```tsx
// app/layout.tsx
<ThemeProvider defaultTheme="system">
  {children}
</ThemeProvider>
```

---

## Icons Used

From `lucide-react`:

| Icon | Usage |
|------|-------|
| `Upload` | Upload zone |
| `X` | Close/Remove buttons |
| `Plus` | Create new |
| `Trash2` | Delete |
| `Download` | Download button |
| `Check` | Success indicator |
| `ChevronLeft` | Back navigation |
| `ChevronRight` | Next navigation |
| `Loader2` | Loading spinner |
| `Image` | Photo placeholder |
| `Sparkles` | AI indicator |
| `Crown` | Pro badge |
| `CreditCard` | Payment |
| `User` | Profile |
| `Settings` | Settings |
| `Moon` | Dark mode |
| `Sun` | Light mode |
| `Camera` | Photo action |
| `Wand2` | Magic/AI |

---

## Styling Patterns

### Tailwind CSS 4 Classes

```tsx
// Common patterns used

// Card
<div className="rounded-xl border bg-card p-4 shadow-sm">

// Button (primary)
<button className="bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:bg-primary/90">

// Button (outline)
<button className="border border-input bg-background rounded-lg px-4 py-2 hover:bg-accent">

// Grid
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

// Responsive container
<div className="container mx-auto px-4 max-w-4xl">
```

### CSS Variables (OKLCH)

```css
/* styles/globals.css */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  /* ... */
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  /* ... */
}
```

---

## Component Communication

```
PersonaApp
    │
    ├── State lifted to top
    │
    ├── Props passed down to sub-components
    │
    └── Callbacks passed for actions
        │
        ├── OnboardingView
        │   └── onNext, onSkip → Update viewState
        │
        ├── DashboardView
        │   └── onCreateNew → Set viewState to UPLOAD
        │   └── onSelectPersona → Set currentPersonaIndex
        │
        ├── UploadView
        │   └── onUpload → Update persona.uploadedImages
        │   └── onContinue → Set viewState to SELECT_STYLE
        │
        ├── StyleSelectView
        │   └── onSelect → Set selectedStyle, trigger generation
        │
        └── ResultsView
            └── onDownload → Trigger file download
            └── onGenerateMore → Reset to UPLOAD view
```
