# PersonaApp Refactoring Architecture

## Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                      PersonaApp                              │
│                    (Orchestrator)                            │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐          │
│  │  useAuth   │  │ useAvatars │  │ useGeneration│          │
│  │            │  │            │  │              │          │
│  │ - User ID  │  │ - Load     │  │ - Status     │          │
│  │ - Theme    │  │ - Create   │  │ - Progress   │          │
│  │ - Messages │  │ - Update   │  │ - File utils │          │
│  └────────────┘  └────────────┘  └──────────────┘          │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐          │
│  │ usePayment │  │ usePolling │  │   useSync    │          │
│  │            │  │            │  │              │          │
│  │ - Modal    │  │ - Intervals│  │ - Upload R2  │          │
│  │ - Tiers    │  │ - Cleanup  │  │ - DB save    │          │
│  │ - Handlers │  │ - Timeouts │  │ - Fallback   │          │
│  └────────────┘  └────────────┘  └──────────────┘          │
│                                                              │
│  View State Management + Event Handlers                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
    ┌─────────────────────────────────────────┐
    │         View Components                  │
    ├─────────────────────────────────────────┤
    │  OnboardingView                         │
    │  DashboardView                          │
    │  UploadView                             │
    │  TierSelectView                         │
    │  ResultsView                            │
    └─────────────────────────────────────────┘
```

---

## Data Flow: Photo Upload & Generation

```
User uploads photos
       │
       ▼
┌──────────────────┐
│   UploadView     │
│  (10-20 photos)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────────┐
│ handleUploadComplete │  ← Orchestrator
│  - Validates count   │
│  - Shows message     │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│   useSync.sync()     │  ← Custom hook
│  - Create avatar DB  │
│  - Upload to R2      │
│  - Save references   │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│   TierSelectView     │
│  (Choose pricing)    │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│  handleGenerate()    │  ← Orchestrator
│  - Start generation  │
│  - Update UI state   │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ usePolling.start()   │  ← Custom hook
│  - Poll /api/generate│
│  - Update progress   │
│  - Add photos        │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│   ResultsView        │
│  (23 AI photos)      │
└──────────────────────┘
```

---

## Hook Dependencies

```
useAuth (independent)
  ↓
  └─> userIdentifier, telegramUserId, theme

useAvatars (independent)
  ↓
  └─> personas[], CRUD operations

useGeneration (independent)
  ↓
  └─> isGenerating, progress, fileToBase64

usePayment (independent)
  ↓
  └─> isPaymentOpen, selectedTier

usePolling (independent)
  ↓
  └─> startPolling(), stopPolling()

useSync (depends on nothing)
  ↓
  └─> syncPersonaToServer()

PersonaApp (orchestrator)
  ├─> useAuth()
  ├─> useAvatars()
  ├─> useGeneration()
  ├─> usePayment()
  ├─> usePolling()
  └─> useSync()
```

---

## State Management Pattern

### Before (Monolithic)
```typescript
// All in one component
const [userIdentifier, setUserIdentifier] = useState()
const [personas, setPersonas] = useState()
const [isGenerating, setIsGenerating] = useState()
const [isPaymentOpen, setIsPaymentOpen] = useState()
const [selectedTier, setSelectedTier] = useState()
const [theme, setTheme] = useState()
const pollIntervalsRef = useRef()
const timeoutsRef = useRef()
// ... 20+ more state variables
```

### After (Distributed)
```typescript
// Organized by concern
const auth = useAuth()
const avatars = useAvatars()
const generation = useGeneration()
const payment = usePayment()
const polling = usePolling()
const sync = useSync()

// Local UI state only
const [viewState, setViewState] = useState()
const [isReady, setIsReady] = useState()
const [isReferralOpen, setIsReferralOpen] = useState()
```

---

## Event Flow: Payment Success

```
User clicks "Pay 500₽"
       │
       ▼
┌──────────────────────┐
│ payment.openPayment()│  ← usePayment hook
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│   PaymentModal       │
│  (T-Bank redirect)   │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│   External T-Bank    │
│  (user pays)         │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ /payment/callback    │
│  ?resume_payment=true│
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│   useEffect(init)    │  ← Orchestrator
│  - Detect URL param  │
│  - Find avatar       │
│  - Start generation  │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ polling.startPolling │  ← usePolling hook
│  (status updates)    │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│   ResultsView        │
│  (photos appear)     │
└──────────────────────┘
```

---

## Lifecycle Hooks

```
Mount
  │
  ├─> useAuth
  │     └─> Initialize Telegram SDK
  │           └─> Set userIdentifier
  │                 └─> Trigger avatar load
  │
  ├─> useAvatars
  │     └─> loadAvatarsFromServer()
  │           └─> Populate personas[]
  │
  ├─> usePolling
  │     └─> Setup cleanup on unmount
  │
  └─> PersonaApp useEffect
        ├─> Check for resume_payment
        ├─> Load view state
        └─> Set isReady = true

Runtime
  │
  ├─> User uploads photos
  │     └─> useSync.syncPersonaToServer()
  │
  ├─> User selects tier
  │     └─> usePayment.setSelectedTier()
  │
  └─> Generation starts
        └─> usePolling.startPolling()

Unmount
  │
  └─> usePolling cleanup
        └─> stopAllPolling()
              └─> Clear all intervals & timeouts
```

---

## Responsibility Matrix

| Concern | Before | After |
|---------|--------|-------|
| Telegram auth | PersonaApp | useAuth |
| Avatar CRUD | PersonaApp | useAvatars |
| Generation state | PersonaApp | useGeneration |
| Payment flow | PersonaApp | usePayment |
| Polling intervals | PersonaApp | usePolling |
| Server sync | PersonaApp | useSync |
| View routing | PersonaApp | PersonaApp |
| Event handlers | PersonaApp | PersonaApp |

**Result:** PersonaApp is now a pure orchestrator with clear delegation to specialized hooks.

---

## Testing Strategy

```
Unit Tests (per hook)
  ├─> useAuth
  │     ├─ SDK initialization
  │     ├─ User identifier parsing
  │     └─ Theme toggle
  │
  ├─> useAvatars
  │     ├─ Load from server
  │     ├─ Create persona
  │     └─ Update/delete
  │
  ├─> usePolling
  │     ├─ Start/stop polling
  │     ├─ Multiple concurrent polls
  │     └─ Cleanup on unmount
  │
  └─> useSync
        ├─ R2 upload (success)
        ├─ R2 upload (failure → DB fallback)
        └─ Telegram ID resolution

Integration Tests (orchestrator)
  ├─> Upload → Sync → Tier Select
  ├─> Payment → Resume → Generate
  └─> View state transitions

E2E Tests (full flow)
  ├─> Onboarding → Create Avatar → Upload
  ├─> Select Tier → Payment → Results
  └─> Dashboard → View Results
```

---

## Performance Optimizations

### Hook Memoization
```typescript
// All callbacks use useCallback
const createPersona = useCallback(() => { ... }, [])
const updatePersona = useCallback((id, updates) => { ... }, [])
const loadAvatars = useCallback(async (id) => { ... }, [])
```

### Ref-based Cleanup
```typescript
// usePolling uses refs to avoid stale closures
const pollIntervalsRef = useRef<Map<string, NodeJS.Timeout>>()
const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>()

// Cleanup is guaranteed even if component updates
useEffect(() => {
  return () => stopAllPolling()
}, [])
```

### Lazy Loading
```typescript
// Views loaded dynamically
const OnboardingView = dynamic(() => import("./views/onboarding-view"))
const DashboardView = dynamic(() => import("./views/dashboard-view"))

// Heavy components lazy loaded
const PaymentModal = lazy(() => import("./payment-modal"))
const ReferralPanel = lazy(() => import("./referral-panel"))
```

---

## Migration Path

### Phase 1: Extract Hooks ✅
- Create `hooks/` directory
- Extract 6 custom hooks
- Export from index.ts

### Phase 2: Refactor Orchestrator ✅
- Update PersonaApp to use hooks
- Remove duplicated logic
- Maintain same API

### Phase 3: Verify ✅
- Build passes
- TypeScript checks pass
- No runtime errors

### Phase 4: Test (In Progress)
- Manual testing flows
- Add unit tests
- E2E testing

### Phase 5: Optimize (Future)
- Extract more hooks
- Add performance monitoring
- Improve error boundaries
