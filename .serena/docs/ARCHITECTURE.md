# PinGlass Architecture

## System Overview

```
+---------------------------------------------------------------------+
|                           CLIENT LAYER                               |
+---------------------------------------------------------------------+
|  Browser (React 19 + Next.js 16)                                    |
|  +-- localStorage: device_id, is_pro, onboarding_complete, theme    |
|  +-- PersonaApp Component (State Management)                        |
|  +-- 6 Views: Onboarding, Dashboard, Upload, TierSelect,            |
|               Generating, Results                                    |
+-----------------------------+---------------------------------------+
                              |
                              v
+---------------------------------------------------------------------+
|                           API LAYER                                  |
+---------------------------------------------------------------------+
|  Next.js API Routes (app/api/)                                      |
|  +-- /api/user           - User management (35 lines)               |
|  +-- /api/generate       - AI photo generation (264 lines)          |
|  +-- /api/payment/create - Create payment (73 lines)                |
|  +-- /api/payment/status - Check payment status (88 lines)          |
|  +-- /api/payment/webhook- Payment notifications (58 lines)         |
+-----------------------------+---------------------------------------+
                              |
          +-------------------+-------------------+
          v                   v                   v
+---------------+     +-------------+     +------------------+
|   Neon DB     |     |   T-Bank    |     |  Google Imagen   |
|   PostgreSQL  |     |   Payment   |     |  3.0 API         |
|   (Serverless)|     |   Gateway   |     |  (via YeScale)   |
+---------------+     +-------------+     +------------------+
```

## Component Architecture

### PersonaApp Component Tree

```
PersonaApp (components/persona-app.tsx - 414 lines)
+-- State Management
|   +-- viewState: ViewState (discriminated union)
|   +-- personas: Persona[]
|   +-- isGenerating: boolean
|   +-- isPro: boolean
|   +-- deviceId: string
|   +-- isReady: boolean
|   +-- selectedTier: PricingTier
|   +-- theme: "dark" | "light"
|
+-- OnboardingView (lines 154-226)
|   +-- Animated orbital photo gallery
|   +-- Start / Skip buttons
|
+-- DashboardView (lines 228-280)
|   +-- Persona grid with thumbnails
|   +-- Pricing tiers display (7/15/23 photos)
|   +-- Create new persona button
|
+-- UploadView (lines 282-328)
|   +-- Drag-and-drop zone
|   +-- File input (10-20 photos required)
|   +-- Preview grid with remove buttons
|
+-- TierSelectView (lines 331-364)
|   +-- 3 pricing cards (Starter/Standard/Premium)
|   +-- Price per photo calculation
|   +-- Generate / Pay button
|
+-- GeneratingView (lines 138-152)
|   +-- Progress spinner
|   +-- Photo count indicator
|
+-- ResultsView (lines 366-414)
|   +-- Photo gallery grid
|   +-- Download buttons
|   +-- Generate more option
|
+-- PaymentModal (components/payment-modal.tsx - 323 lines)
    +-- Tier selection
    +-- Feature list
    +-- T-Bank redirect
```

## Data Flow

### 1. User Identification Flow

```
App Load
    |
    v
Check localStorage for device_id
    |
    +-- Exists --> Use existing ID
    |
    +-- Not exists --> Generate UUID --> Save to localStorage
    |
    v
GET /api/payment/status?device_id=xxx
    |
    v
Return { isPro: boolean }
    |
    v
Update React state (isPro, isReady)
```

### 2. Photo Generation Flow

```
User uploads 10-20 photos
    |
    v
User selects tier (7/15/23 photos)
    |
    v
Check isPro status
    |
    +-- Not Pro --> PaymentModal --> T-Bank --> Callback --> Continue
    |
    +-- Is Pro --> Continue
    |
    v
POST /api/generate
{
  deviceId: string,
  avatarId: string,
  styleId: "pinglass",
  photoCount: 7 | 15 | 23,
  referenceImages: base64[]
}
    |
    v
Server: Validate user is Pro
    |
    v
Create generation_job (status: 'processing')
    |
    v
Select N prompts from 23 based on photoCount
    |
    v
For each prompt (sequential):
    |
    +-- Build prompt: prefix + base_prompt + suffix
    |
    +-- Call Google Imagen API with reference image
    |
    +-- Return base64 image
    |
    v
Return { success: true, photos: base64[] }
```

### 3. Payment Flow

```
User clicks "Pay XXX RUB"
    |
    v
POST /api/payment/create { deviceId, tier }
    |
    v
Server: Create T-Bank payment order
    |
    v
Return { paymentId, confirmationUrl }
    |
    v
Redirect to T-Bank payment page
    |
    v
User completes payment
    |
    v
T-Bank redirects to /payment/callback
    |
    v
Callback page: Poll /api/payment/status
    |
    +-- Payment succeeded --> Update user.is_pro = true
    |
    +-- Payment pending --> Continue polling
    |
    v
Redirect to home with Pro activated
```

## Directory Structure

```
PinGlass/
+-- app/                           # Next.js App Router
|   +-- api/                       # API Routes
|   |   +-- generate/route.ts      # Photo generation (264 lines)
|   |   +-- payment/
|   |   |   +-- create/route.ts    # Create payment (73 lines)
|   |   |   +-- status/route.ts    # Check status (88 lines)
|   |   |   +-- webhook/route.ts   # Webhooks (58 lines)
|   |   +-- test-models/route.ts   # API testing (31 lines)
|   |   +-- user/route.ts          # User CRUD (35 lines)
|   +-- payment/callback/
|   |   +-- page.tsx               # Callback handler
|   |   +-- loading.tsx            # Loading state
|   +-- layout.tsx                 # Root layout
|   +-- page.tsx                   # Home page
|
+-- components/                    # React Components
|   +-- persona-app.tsx            # Main app (414 lines)
|   +-- payment-modal.tsx          # Payment UI (323 lines)
|   +-- theme-provider.tsx         # Dark mode (11 lines)
|
+-- lib/                           # Business Logic
|   +-- db.ts                      # Database client (63 lines)
|   +-- imagen.ts                  # Google Imagen (521 lines)
|   +-- image-utils.ts             # Image processing (280 lines)
|   +-- tbank.ts                   # T-Bank payment (240 lines)
|   +-- prompts.ts                 # 23 prompts + styles (103 lines)
|   +-- replicate.ts               # Replicate API (252 lines)
|   +-- yescale.ts                 # YeScale proxy (137 lines)
|   +-- yookassa.ts                # Legacy YooKassa (116 lines)
|   +-- utils.ts                   # Utilities (6 lines)
|
+-- styles/
|   +-- globals.css                # OKLCH CSS variables
|
+-- public/                        # Static assets
    +-- demo/                      # Demo screenshots
```

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js | 16.x |
| UI Library | React | 19.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Database | Neon PostgreSQL | serverless |
| AI API | Google Imagen | 3.0 |
| Payments | T-Bank | SDK 2.0 |
| Icons | Lucide React | 0.454.0 |

## Security Architecture

### Authentication
- Device ID-based identification (localStorage)
- No password authentication
- Pro status verified server-side on each API call

### Payment Security
- T-Bank handles PCI compliance
- SHA-256 token verification for webhooks
- Payment status validated server-side

### API Security
- Environment variables for secrets
- Parameterized SQL queries (Neon)
- No rate limiting (TODO)

## State Management

### Client State (React useState)
```typescript
// PersonaApp state
const [viewState, setViewState] = useState<ViewState>({ view: "ONBOARDING" })
const [personas, setPersonas] = useState<Persona[]>([])
const [isGenerating, setIsGenerating] = useState(false)
const [isPro, setIsPro] = useState(false)
const [deviceId, setDeviceId] = useState("")
const [isReady, setIsReady] = useState(false)
const [selectedTier, setSelectedTier] = useState<PricingTier>(PRICING_TIERS[1])
const [theme, setTheme] = useState<"dark" | "light">("dark")
```

### Persistent State (localStorage)
```
pinglass_device_id           - Unique browser identifier
pinglass_is_pro              - Pro subscription status
pinglass_onboarding_complete - Tutorial completion flag
pinglass_theme               - Dark/light mode preference
```

### Server State (Database)
- Users with Pro status
- Avatars with generation status
- Generated photos with URLs
- Payment records
- Generation job progress

## Pricing Model

| Tier | Photos | Price | Per Photo |
|------|--------|-------|-----------|
| Starter | 7 | 499 RUB | ~71 RUB |
| Standard | 15 | 999 RUB | ~67 RUB |
| Premium | 23 | 1499 RUB | ~65 RUB |
