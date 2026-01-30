# Code Style & Patterns

## Naming Conventions

| Context | Convention | Example |
|---------|------------|---------|
| Database columns | snake_case | `telegram_user_id`, `created_at` |
| TypeScript variables | camelCase | `telegramUserId`, `createdAt` |
| API query params | snake_case | `?telegram_user_id=123` |
| API request body | camelCase | `{ telegramUserId: 123 }` |
| Environment vars | SCREAMING_SNAKE | `DATABASE_URL`, `TBANK_PASSWORD` |
| React components | PascalCase | `PaymentModal`, `PersonaApp` |
| CSS classes | kebab-case | `payment-modal`, `btn-primary` |

## Async Generation Pattern

The core pattern for AI generation to avoid Cloudflare timeouts:

```typescript
// 1. Create task in database
const task = await createKieTask({
  jobId,
  promptIndex,
  status: 'pending'
});

// 2. Fire request to AI provider (don't await result)
fireAndForget(kieApi.generate(prompt));

// 3. Cron job polls for completion
// app/api/cron/check-kie-tasks/route.ts
```

## Payment Provider Pattern

Multi-provider support with unified interface:

```typescript
interface PaymentResult {
  paymentId: string;
  confirmationUrl: string;
  provider: 'tbank' | 'stars' | 'ton';
}
```

## Error Handling

```typescript
// API routes follow this pattern
try {
  // ... business logic
  return NextResponse.json({ success: true, data });
} catch (error) {
  console.error('Operation failed:', error);
  return NextResponse.json(
    { error: 'Operation failed' },
    { status: 500 }
  );
}
```

## Structured Error Responses (NEW 2026-01-30)

```typescript
// Full error structure for client-side handling
return NextResponse.json({
  success: false,
  error: {
    code: 'QUOTA_EXCEEDED',           // Machine-readable
    message: 'Quota exceeded...',     // English (logs)
    userMessage: 'Лимит исчерпан',    // Localized (UI)
    retryable: false                  // Client hint
  },
  context: { limit, used, remaining } // Debug data
}, { status: 429 })
```

## Lazy Entity Creation Pattern (NEW 2026-01-30)

Defer database write until user commits:

```typescript
// 1. Create temp client-side entity
const tempId = `temp_${Date.now()}`
setEntities([...entities, { id: tempId }])

// 2. Sync to DB only when user commits
const dbId = await syncToServer(entity)
updateEntity(tempId, { id: dbId })

// 3. Cleanup on cancel (filter temp from counts!)
if (id.startsWith("temp_")) {
  setEntities(prev => prev.filter(e => e.id !== id))
  URL.revokeObjectURL(blobUrl) // Memory cleanup!
}
```

## Atomic Limit Enforcement (NEW 2026-01-30)

Prevent TOCTOU race conditions:

```sql
-- ❌ WRONG: Race between SELECT and INSERT
SELECT COUNT(*) FROM items WHERE parent_id = $1
-- if count < limit...
INSERT INTO items ...

-- ✅ CORRECT: Atomic CTE + WHERE
WITH count_check AS (
  SELECT COUNT(*) as count FROM items WHERE parent_id = $1
)
INSERT INTO items (parent_id, data)
SELECT $1, $2 FROM count_check WHERE count < 23
RETURNING *
```

## Session Timeout Protection (NEW 2026-01-30)

For Edge runtime cookie access:

```typescript
// cookies() can hang in Edge - use race pattern
const sessionPromise = getCurrentSession()
const timeoutPromise = new Promise(r => setTimeout(() => r(null), 5000))
const session = await Promise.race([sessionPromise, timeoutPromise])
```

## Runtime Configuration (NEW 2026-01-30)

Required for bcrypt, long queries:

```typescript
// Add to ALL auth endpoints
export const runtime = 'nodejs'  // bcrypt fails silently in Edge!
export const dynamic = 'force-dynamic'
export const maxDuration = 60    // bcrypt is CPU-intensive
```

## Non-Critical Error Handling (NEW 2026-01-30)

```typescript
// For analytics, previews, cleanup - don't fail main operation
try {
  await updatePackPreviewImages(packId)
} catch (error) {
  console.error("Preview update failed:", error)
  // DON'T rethrow - main operation should succeed
}
```

## Relations
@structure/api/endpoints
@testing/strategies/unit-testing
@bug_fixes/known-issues
