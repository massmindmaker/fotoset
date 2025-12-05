# PinGlass Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                               │
├─────────────────────────────────────────────────────────────────────┤
│  Browser (React 19 + Next.js 16)                                    │
│  ├── localStorage: device_id, is_pro, onboarding_complete           │
│  ├── PersonaApp Component (State Management)                        │
│  └── 6 Views: Onboarding, Dashboard, Upload, Style, Generate, Results│
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           API LAYER                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Next.js API Routes (app/api/)                                      │
│  ├── /api/user           - User management                          │
│  ├── /api/generate       - AI photo generation                      │
│  ├── /api/payment/create - Create payment                           │
│  ├── /api/payment/status - Check payment status                     │
│  └── /api/payment/webhook- Payment notifications                    │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│   Neon DB       │ │  T-Bank     │ │  Google Imagen  │
│   PostgreSQL    │ │  Payment    │ │  3.0 API        │
│   (Serverless)  │ │  Gateway    │ │  (via YeScale)  │
└─────────────────┘ └─────────────┘ └─────────────────┘
```

## Component Architecture

### PersonaApp Component Tree

```
PersonaApp (components/persona-app.tsx)
├── State Management
│   ├── viewState: ViewState enum
│   ├── personas: Persona[]
│   ├── currentPersonaIndex: number
│   ├── isPro: boolean
│   ├── deviceId: string
│   └── isReady: boolean (hydration)
│
├── OnboardingView (lines 423-517)
│   ├── 3-step carousel
│   └── Skip / Continue buttons
│
├── DashboardView (lines 518-645)
│   ├── Persona grid
│   ├── Create new persona button
│   └── Delete persona functionality
│
├── UploadView (lines 646-792)
│   ├── Drag-and-drop zone
│   ├── File input (10-20 photos)
│   └── Preview with remove option
│
├── StyleSelectView (lines 793-885)
│   ├── 3 style cards (Professional, Lifestyle, Creative)
│   └── Style descriptions
│
├── GeneratingView (lines 390-422)
│   ├── Progress spinner
│   └── Status message
│
├── ResultsView (lines 886-1032)
│   ├── Photo gallery grid
│   ├── Download buttons
│   └── Generate More option
│
└── PaymentModal (components/payment-modal.tsx)
    ├── Feature list
    └── Pay button → T-Bank redirect
```

## Data Flow

### 1. User Identification Flow

```
App Load
    │
    ▼
Check localStorage for device_id
    │
    ├── Exists → Use existing ID
    │
    └── Not exists → Generate UUID → Save to localStorage
    │
    ▼
POST /api/user { deviceId }
    │
    ▼
Database: Get or Create User
    │
    ▼
Return { id, deviceId, isPro }
    │
    ▼
Update React state (isPro)
```

### 2. Photo Generation Flow

```
User uploads 10-20 photos
    │
    ▼
User selects style (Professional/Lifestyle/Creative)
    │
    ▼
Check isPro status
    │
    ├── Not Pro → Show PaymentModal → Complete payment → Continue
    │
    └── Is Pro → Continue
    │
    ▼
POST /api/generate
{
  deviceId: string,
  avatarId: string,
  styleId: "professional" | "lifestyle" | "creative",
  referenceImages: base64[]
}
    │
    ▼
Server: Validate user is Pro
    │
    ▼
Create generation_job (status: 'processing')
    │
    ▼
Get style config → Select 9 prompts from 23
    │
    ▼
For each prompt (parallel, concurrency: 3):
    │
    ├── Build prompt: prefix + base_prompt + suffix
    │
    ├── Call Google Imagen API with reference image
    │
    ├── Save generated photo to database
    │
    └── Update job progress
    │
    ▼
Update avatar status → 'ready'
    │
    ▼
Return { success: true, photos: urls[] }
```

### 3. Payment Flow

```
User clicks "Pay 500₽"
    │
    ▼
POST /api/payment/create { deviceId }
    │
    ▼
Server: Create T-Bank payment order
    │
    ▼
Return { paymentId, confirmationUrl }
    │
    ▼
Redirect to T-Bank payment page
    │
    ▼
User completes payment
    │
    ▼
T-Bank redirects to /payment/callback
    │
    ▼
Callback page: Poll /api/payment/status
    │
    ├── Payment succeeded → Update user.is_pro = true
    │
    └── Payment pending → Continue polling
    │
    ▼
Redirect to home with Pro activated
```

## Directory Structure

```
PinGlass/
├── app/                           # Next.js App Router
│   ├── api/                       # API Routes
│   │   ├── generate/route.ts      # Photo generation (90 lines)
│   │   ├── payment/
│   │   │   ├── create/route.ts    # Create payment (64 lines)
│   │   │   ├── status/route.ts    # Check status (88 lines)
│   │   │   └── webhook/route.ts   # Webhooks (58 lines)
│   │   ├── test-models/route.ts   # API testing (58 lines)
│   │   └── user/route.ts          # User CRUD (35 lines)
│   ├── payment/callback/
│   │   ├── page.tsx               # Callback handler
│   │   └── loading.tsx            # Loading state
│   ├── layout.tsx                 # Root layout (41 lines)
│   ├── page.tsx                   # Home page (5 lines)
│   └── globals.css                # Global styles
│
├── components/                    # React Components
│   ├── persona-app.tsx            # Main app (1099 lines)
│   ├── payment-modal.tsx          # Payment UI (79 lines)
│   └── theme-provider.tsx         # Dark mode (11 lines)
│
├── lib/                           # Business Logic
│   ├── db.ts                      # Database client (63 lines)
│   ├── imagen.ts                  # Google Imagen (84 lines)
│   ├── tbank.ts                   # T-Bank payment (175 lines)
│   ├── yescale.ts                 # YeScale proxy (137 lines)
│   ├── yookassa.ts                # Legacy YooKassa (116 lines)
│   ├── prompts.ts                 # 23 prompts + styles (96 lines)
│   └── utils.ts                   # Utilities (6 lines)
│
├── styles/
│   └── globals.css                # OKLCH CSS variables
│
└── public/                        # Static assets (19 files)
```

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js | 16.0.4 |
| UI Library | React | 19.2.0 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.1.9 |
| Database | Neon PostgreSQL | serverless |
| AI API | Google Imagen | 3.0 |
| Payments | T-Bank | SDK 2.0.0 |
| Icons | Lucide React | 0.454.0 |
| Analytics | Vercel Analytics | latest |

## Security Architecture

### Authentication
- Device ID-based identification (localStorage)
- No password authentication
- Pro status verified server-side

### Payment Security
- T-Bank handles PCI compliance
- SHA-256 token verification for webhooks
- Payment status validated server-side

### API Security
- Environment variables for secrets
- Parameterized SQL queries
- No rate limiting (TODO)

## State Management

### Client State (React hooks)
```typescript
// PersonaApp state
const [viewState, setViewState] = useState<ViewState>('ONBOARDING')
const [personas, setPersonas] = useState<Persona[]>([])
const [currentPersonaIndex, setCurrentPersonaIndex] = useState(0)
const [isPro, setIsPro] = useState(false)
const [deviceId, setDeviceId] = useState('')
const [isReady, setIsReady] = useState(false)
```

### Persistent State (localStorage)
```
photoset_device_id       - Unique browser identifier
photoset_is_pro          - Pro subscription status
photoset_onboarding_complete - Tutorial completion flag
```

### Server State (Database)
- Users with Pro status
- Avatars with generation status
- Generated photos with URLs
- Payment records
- Generation job progress
