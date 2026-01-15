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

## Relations
@structure/api/endpoints
@structure/payments
@code_style/patterns/error-handling
