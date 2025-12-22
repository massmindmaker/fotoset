# Custom Hooks Quick Reference

## Import

```typescript
import { useAuth, useAvatars, useGeneration, usePayment, usePolling, useSync } from '@/components/hooks'
```

---

## useAuth()

**Purpose:** Telegram WebApp authentication and user management

```typescript
const {
  userIdentifier,    // UserIdentifier | null
  authStatus,        // 'pending' | 'success' | 'failed' | 'not_in_telegram'
  telegramUserId,    // number | undefined
  theme,             // 'dark' | 'light'
  toggleTheme,       // () => void
  showMessage        // (message: string) => void
} = useAuth()
```

**Example:**
```typescript
if (authStatus === 'success') {
  console.log('User ID:', telegramUserId)
}

showMessage('Hello from Telegram!')
toggleTheme() // Switch dark/light mode
```

---

## useAvatars()

**Purpose:** Avatar CRUD operations

```typescript
const {
  personas,              // Persona[]
  setPersonas,           // Dispatch<SetStateAction<Persona[]>>
  loadAvatarsFromServer, // (identifier: UserIdentifier) => Promise<Persona[]>
  createPersona,         // () => string (returns temp ID)
  updatePersona,         // (id: string, updates: Partial<Persona>) => void
  deletePersona,         // (id: string) => void
  getPersona             // (id: string) => Persona | null
} = useAvatars()
```

**Example:**
```typescript
// Load from server
const avatars = await loadAvatarsFromServer(userIdentifier)

// Create new
const tempId = createPersona()

// Update
updatePersona(tempId, { name: 'New Name', status: 'processing' })

// Delete
deletePersona(tempId)

// Get by ID
const persona = getPersona(tempId)
```

---

## useGeneration()

**Purpose:** AI photo generation state

```typescript
const {
  isGenerating,         // boolean
  setIsGenerating,      // Dispatch<SetStateAction<boolean>>
  generationProgress,   // { completed: number, total: number }
  setGenerationProgress,// Dispatch<SetStateAction<GenerationProgress>>
  fileToBase64          // (file: File) => Promise<string>
} = useGeneration()
```

**Example:**
```typescript
// Start generation
setIsGenerating(true)
setGenerationProgress({ completed: 0, total: 23 })

// Convert files to base64
const images = await Promise.all(
  files.map(file => fileToBase64(file))
)

// Update progress
setGenerationProgress({ completed: 10, total: 23 })

// Stop
setIsGenerating(false)
```

---

## usePayment()

**Purpose:** Payment modal and tier selection

```typescript
const {
  isPaymentOpen,   // boolean
  setIsPaymentOpen,// Dispatch<SetStateAction<boolean>>
  selectedTier,    // PricingTier | null
  setSelectedTier, // Dispatch<SetStateAction<PricingTier | null>>
  openPayment,     // (tier: PricingTier) => void
  closePayment     // () => void
} = usePayment()
```

**Example:**
```typescript
// Open payment for specific tier
openPayment(PRICING_TIERS[1]) // Standard tier

// Close payment
closePayment()

// Check state
if (isPaymentOpen && selectedTier) {
  console.log('User selected:', selectedTier.id)
}
```

---

## usePolling()

**Purpose:** Status polling with cleanup

```typescript
const {
  startPolling,   // (key: string, callback: () => void | Promise<void>, intervalMs: number, timeoutMs?: number) => void
  stopPolling,    // (key: string) => void
  stopAllPolling  // () => void
} = usePolling()
```

**Example:**
```typescript
// Start polling generation status
startPolling(
  'job-123',                    // Unique key
  async () => {                 // Callback
    const res = await fetch(`/api/generate?job_id=123`)
    const data = await res.json()

    if (data.status === 'completed') {
      stopPolling('job-123')
    }
  },
  3000,           // Poll every 3 seconds
  15 * 60 * 1000  // Timeout after 15 minutes
)

// Stop specific poll
stopPolling('job-123')

// Stop all polls (auto-called on unmount)
stopAllPolling()
```

---

## useSync()

**Purpose:** Sync persona to server (create avatar + upload photos)

```typescript
const {
  isSyncing,            // boolean
  setIsSyncing,         // Dispatch<SetStateAction<boolean>>
  syncPersonaToServer   // (persona: Persona, telegramUserId?: number) => Promise<string>
} = useSync()
```

**Example:**
```typescript
setIsSyncing(true)

try {
  // Sync persona to server
  // - Creates avatar in DB if new
  // - Uploads photos to R2
  // - Saves references to DB
  // - Returns DB avatar ID
  const dbAvatarId = await syncPersonaToServer(persona, telegramUserId)

  console.log('Avatar ID:', dbAvatarId) // "123"

  // Update persona with DB ID
  updatePersona(persona.id, { id: dbAvatarId })
} catch (error) {
  console.error('Sync failed:', error)
} finally {
  setIsSyncing(false)
}
```

---

## Common Patterns

### Pattern 1: Initialize App

```typescript
function MyApp() {
  const { userIdentifier, authStatus } = useAuth()
  const { loadAvatarsFromServer } = useAvatars()

  useEffect(() => {
    if (authStatus === 'success' && userIdentifier) {
      loadAvatarsFromServer(userIdentifier)
    }
  }, [authStatus, userIdentifier])
}
```

### Pattern 2: Upload & Generate

```typescript
const handleUploadComplete = async () => {
  const { syncPersonaToServer } = useSync()
  const { setIsGenerating } = useGeneration()

  setIsGenerating(true)
  const dbId = await syncPersonaToServer(persona, telegramUserId)
  setIsGenerating(false)

  // Navigate to tier selection
  setViewState({ view: 'SELECT_TIER', personaId: dbId })
}
```

### Pattern 3: Poll Generation Status

```typescript
const handleGenerate = async (tier: PricingTier) => {
  const { startPolling, stopPolling } = usePolling()
  const { setGenerationProgress } = useGeneration()

  // Start generation
  const res = await fetch('/api/generate', { ... })
  const { jobId } = await res.json()

  // Poll for updates
  startPolling(
    `job-${jobId}`,
    async () => {
      const status = await fetch(`/api/generate?job_id=${jobId}`)
      const data = await status.json()

      setGenerationProgress({
        completed: data.progress.completed,
        total: data.progress.total
      })

      if (data.status === 'completed') {
        stopPolling(`job-${jobId}`)
      }
    },
    3000,
    15 * 60 * 1000
  )
}
```

### Pattern 4: Payment Flow

```typescript
const handleSelectTier = (tier: PricingTier) => {
  const { openPayment } = usePayment()

  // Open payment modal
  openPayment(tier)
}

const handlePaymentSuccess = () => {
  const { closePayment, selectedTier } = usePayment()

  closePayment()

  // Start generation with selected tier
  handleGenerate(selectedTier)
}
```

---

## TypeScript Interfaces

### UserIdentifier
```typescript
interface UserIdentifier {
  type: "telegram"
  telegramUserId: number
  deviceId?: string
}
```

### AuthStatus
```typescript
type AuthStatus = 'pending' | 'success' | 'failed' | 'not_in_telegram'
```

### Persona
```typescript
interface Persona {
  id: string
  name: string
  status: "draft" | "processing" | "ready"
  images: UploadedImage[]
  generatedAssets: GeneratedAsset[]
  thumbnailUrl?: string
}
```

### PricingTier
```typescript
interface PricingTier {
  id: string
  photos: number
  price: number
  popular?: boolean
}
```

### GenerationProgress
```typescript
interface GenerationProgress {
  completed: number
  total: number
}
```

---

## Hook Dependencies

```
useAuth        - Independent
useAvatars     - Independent
useGeneration  - Independent
usePayment     - Independent
usePolling     - Independent
useSync        - Independent

All hooks can be used independently or combined in any order.
```

---

## Best Practices

### 1. Always cleanup polling
```typescript
// ✅ Good - polling cleaned up automatically
const { startPolling, stopPolling } = usePolling()

useEffect(() => {
  startPolling('key', callback, 3000)
  // Cleanup happens automatically on unmount
}, [])
```

### 2. Use callbacks for updates
```typescript
// ✅ Good - functional update
setPersonas(prev => prev.map(p =>
  p.id === id ? { ...p, status: 'ready' } : p
))

// ❌ Bad - stale closure
setPersonas(personas.map(p =>
  p.id === id ? { ...p, status: 'ready' } : p
))
```

### 3. Handle loading states
```typescript
const { isSyncing, syncPersonaToServer } = useSync()
const { isGenerating } = useGeneration()

if (isSyncing || isGenerating) {
  return <Loader />
}
```

### 4. Show user feedback
```typescript
const { showMessage } = useAuth()

try {
  await syncPersonaToServer(persona)
  showMessage('Фото загружены успешно!')
} catch (error) {
  showMessage('Ошибка: ' + error.message)
}
```

---

## Troubleshooting

### Auth not working
```typescript
const { authStatus, userIdentifier } = useAuth()

console.log('Auth status:', authStatus)
console.log('User ID:', userIdentifier?.telegramUserId)

// Check if in Telegram
if (authStatus === 'not_in_telegram') {
  // Show error UI
}
```

### Polling not stopping
```typescript
const { stopPolling } = usePolling()

// Make sure to use the SAME key
startPolling('job-123', callback, 3000)
stopPolling('job-123') // ✅ Same key

// ❌ Different key won't work
stopPolling('job-456')
```

### Sync failing
```typescript
const { syncPersonaToServer } = useSync()

try {
  const dbId = await syncPersonaToServer(persona, telegramUserId)
} catch (error) {
  // Check error type
  if (error.message.includes('Telegram ID')) {
    // Auth issue
  } else if (error.message.includes('R2')) {
    // Upload issue (fallback to DB should work)
  }
}
```

---

## Performance Tips

1. **Memoize callbacks** - Hooks already use `useCallback`
2. **Batch updates** - React batches state updates automatically
3. **Lazy load** - Views are already lazy loaded
4. **Debounce user input** - Use `useMemo` for expensive computations
5. **Optimize re-renders** - Use `React.memo` on child components

---

## File Locations

```
components/
├── hooks/
│   ├── index.ts              # Barrel export
│   ├── useAuth.ts
│   ├── useAvatars.ts
│   ├── useGeneration.ts
│   ├── usePayment.ts
│   ├── usePolling.ts
│   └── useSync.ts
└── persona-app.tsx           # Main component (uses all hooks)
```

---

## Version History

- **v1.0.0** (2025-12-20) - Initial refactoring
  - Extracted 6 custom hooks from God Component
  - Reduced main component from 1348 to 832 LOC
  - Zero breaking changes
  - Build passing
