# Known Issues & Bug Fixes

## 1. telegram_queue Table Does Not Exist

**Problem:** Queries to `telegram_queue` fail - table doesn't exist.

**Solution:**
```sql
-- ❌ Wrong
SELECT * FROM telegram_queue

-- ✅ Correct
SELECT * FROM telegram_message_queue tmq
JOIN users u ON u.telegram_chat_id = tmq.chat_id
```

## 2. User Status Anti-Pattern

**Problem:** Code checking for `is_pro`, `isPro`, `user_is_pro` - these don't exist!

**Solution:**
```sql
-- Access = successful payment exists
SELECT COUNT(*) > 0 as has_access
FROM payments 
WHERE user_id = $1 AND status = 'succeeded'
```

## 3. Cloudflare Timeout on Generation

**Problem:** Synchronous AI generation times out after 100 seconds.

**Solution:** Use async task pattern:
```typescript
// Fire-and-forget + cron polling
await createKieTask(prompt);
// Cron job checks status every minute
```

## 4. Payment Webhook Signature Mismatch

**Problem:** T-Bank webhook returns 400 - signature verification fails.

**Root Cause:** JSON key ordering matters for signature calculation.

**Solution:**
```typescript
// Sort keys before hashing
const sortedData = Object.keys(data).sort().reduce((obj, key) => {
  obj[key] = data[key];
  return obj;
}, {});
```

## 5. Device ID Not Persisting

**Problem:** User loses session on page refresh.

**Solution:** Store in localStorage with correct key:
```typescript
const DEVICE_ID_KEY = 'pinglass_device_id';
localStorage.setItem(DEVICE_ID_KEY, deviceId);
```

## 6. Edge Runtime + bcrypt Incompatibility (NEW 2026-01-30)

**Problem:** bcrypt.compare() silently returns `false` in Vercel Edge Runtime.

**Root Cause:** bcryptjs (pure JS) requires Node.js runtime, not Edge.

**Solution:**
```typescript
// Add to ALL auth endpoints
export const runtime = 'nodejs'  // CRITICAL!
export const maxDuration = 60    // bcrypt is CPU-intensive
```

**Files Affected:** All routes in `app/api/admin/auth/` and `app/api/partner/auth/`

## 7. React Context Infinite Re-render (NEW 2026-01-30)

**Problem:** Admin panel freezes when visiting Prompts tab.

**Root Cause:** Context value object recreated every render → consumers re-render → infinite loop.

**Solution:**
```typescript
// ❌ WRONG
return <Context.Provider value={{ data, setData }}>

// ✅ CORRECT
const value = useMemo(() => ({ data, setData }), [data])
return <Context.Provider value={value}>
```

**Commit:** af3db77

## 8. TOCTOU Race in Limit Checks (NEW 2026-01-30)

**Problem:** Concurrent requests can bypass limits (e.g., 23 prompts per pack).

**Solution:** Atomic CTE + WHERE:
```sql
WITH count_check AS (
  SELECT COUNT(*) as count FROM items WHERE parent_id = $1
)
INSERT INTO items (parent_id, data)
SELECT $1, $2 FROM count_check WHERE count < 23
RETURNING *
```

## 9. Debug Code Left in Production (NEW 2026-01-30)

**Problem:** Security vulnerability - rate limit bypass in production.

**Files to Remove:**
- `app/api/test-login/route.ts`
- `app/api/debug/bypass-login/route.ts`
- `lib/admin/rate-limit.ts:26-31` (DISABLE_RATE_LIMIT)
- `app/api/auth/unified-login/route.ts:46-51` (header bypass)

**Root Cause:** Rate limiting blocked debugging, developers added bypasses instead of proper test environment.

## 10. External Preview URLs Blocked in Telegram (NEW 2026-01-30)

**Problem:** Kie.ai temporary URLs don't display in Telegram WebApp (CSP/CORS).

**Solution:** Copy external images to R2:
```typescript
if (isExternalPreviewUrl(url)) {
  const key = `previews/pack-${packId}/prompt-${promptId}-${Date.now()}.jpg`
  const result = await uploadFromUrl(url, key)  // lib/r2.ts
  await sql`UPDATE pack_prompts SET preview_url = ${result.url}`
}
```

## Relations
@structure/api/endpoints
@structure/payments
@code_style/patterns/error-handling
@code_style/patterns
