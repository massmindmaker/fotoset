# Test Report: Admin Telegram Queue API

**Test File:** `tests/unit/api/admin/telegram.test.ts`
**Total Tests:** 31 (all passing)
**Execution Time:** ~3.3s
**Date:** 2025-12-31

---

## Coverage Summary

### Routes Tested
1. `GET /api/admin/telegram` - Queue stats and message list
2. `POST /api/admin/telegram/send` - Send manual message
3. `POST /api/admin/telegram/[id]/retry` - Retry failed message

---

## Test Breakdown

### GET /api/admin/telegram (11 tests)

**Core Functionality:**
- ✓ Returns queue stats and messages with default pagination
- ✓ Filters messages by status (pending, sent, failed, retry)
- ✓ Paginates results correctly (page, limit)
- ✓ Calculates success_rate accurately (sent/total * 100)
- ✓ Handles zero total with success_rate = 0
- ✓ Includes user info (telegram_user_id, user_id)
- ✓ Returns empty data when table doesn't exist

**Input Validation:**
- ✓ Validates and sanitizes status parameter (ignores invalid values)
- ✓ Enforces pagination limits (max 100 per page)

**Security & Error Handling:**
- ✓ Returns 401 without session
- ✓ Handles database errors gracefully (500 error)

**Success Rate Calculation:**
- Formula: `(sent_messages / total_messages) * 100`
- Edge case: Returns 0 when total = 0 (prevents division by zero)

---

### POST /api/admin/telegram/send (10 tests)

**Core Functionality:**
- ✓ Sends test message successfully
- ✓ Creates queue table if it doesn't exist
- ✓ Supports custom message types (default: 'admin_notification')
- ✓ Truncates long messages in audit log preview (100 chars max)

**Validation:**
- ✓ Returns 400 when telegramUserId is missing
- ✓ Returns 400 when message is missing
- ✓ Returns 404 when user not found

**Security & Audit:**
- ✓ Returns 401 without session
- ✓ Logs audit action on successful send
- ✓ Handles database errors (500 error)

**Audit Log Format:**
```typescript
{
  adminId: 1,
  action: 'telegram_test_sent',
  targetId: messageId,
  metadata: {
    user_id: 5,
    telegram_user_id: '12345',
    message_type: 'admin_notification',
    message_preview: 'First 100 chars...'
  }
}
```

---

### POST /api/admin/telegram/[id]/retry (10 tests)

**Core Functionality:**
- ✓ Retries failed message successfully
- ✓ Increments retry_count by 1
- ✓ Resets status to 'pending'
- ✓ Clears error_message (NULL)

**Validation:**
- ✓ Returns 404 for non-existent message
- ✓ Returns 400 when message status is not 'failed'
- ✓ Returns 400 when retry count exceeds maximum (5 retries)
- ✓ Returns 400 for invalid message ID (non-numeric)

**Security & Audit:**
- ✓ Returns 401 without session
- ✓ Logs audit action on successful retry

**Retry Logic:**
- Only 'failed' messages can be retried
- Maximum retries: 5 attempts
- Increments `retry_count` on each retry
- Clears previous `error_message`
- Resets `status` to 'pending' for re-processing

**Audit Log Format:**
```typescript
{
  adminId: 1,
  action: 'telegram_message_retried',
  targetId: messageId,
  metadata: {
    user_id: 10,
    message_type: 'photo',
    previous_retry_count: 2
  }
}
```

---

## Test Patterns Used

### Mock Setup
```typescript
const mockSql = jest.fn()
const mockGetCurrentSession = jest.fn()
const mockLogAdminAction = jest.fn()

jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(() => mockSql)
}))

jest.mock('@/lib/admin/session', () => ({
  getCurrentSession: () => mockGetCurrentSession()
}))

jest.mock('@/lib/admin/audit', () => ({
  logAdminAction: (...args: any[]) => mockLogAdminAction(...args)
}))
```

### Database Mock Chain
```typescript
mockSql
  .mockResolvedValueOnce([{ exists: true }])  // table check
  .mockResolvedValueOnce([mockStats])         // stats query
  .mockResolvedValueOnce([mockCount])         // count query
  .mockResolvedValueOnce([mockMessages])      // messages query
```

### SQL Query Validation
```typescript
const updateCall = mockSql.mock.calls[1]
const sqlQuery = updateCall[0].join('')
expect(sqlQuery).toContain('retry_count = retry_count + 1')
```

---

## Key Business Logic Verified

### Queue Statistics
- Tracks 4 message statuses: pending, sent, failed, retry
- Calculates overall success rate
- Provides total message count

### Message Filtering
- Status-based filtering (pending, sent, failed, retry)
- Invalid statuses are ignored (no filter applied)
- Pagination with configurable page/limit
- Maximum limit enforced at 100 per page

### Send Functionality
- Creates queue table on-demand if missing
- Links messages to users via telegram_user_id
- Defaults to 'admin_notification' message type
- Logs all send actions for audit trail

### Retry Mechanism
- Maximum 5 retry attempts per message
- Only failed messages can be retried
- Atomic update: status→pending, retry_count++, error_message→NULL
- Tracks retry history in metadata

---

## Edge Cases Covered

1. **Empty Queue**: Returns zero stats when table doesn't exist
2. **Division by Zero**: Success rate = 0 when no messages exist
3. **Invalid Status**: Ignores invalid status filters
4. **Pagination Overflow**: Caps limit at 100, ensures page ≥ 1
5. **Long Messages**: Truncates audit preview to 100 chars
6. **Max Retries**: Blocks retry when count ≥ 5
7. **Non-Failed Status**: Prevents retry of pending/sent messages
8. **Missing User**: 404 when telegram_user_id not found

---

## Security Measures Tested

1. **Session Validation**: All endpoints return 401 without valid session
2. **Audit Logging**: Critical actions logged with admin context
3. **Input Sanitization**: Status parameter validated against whitelist
4. **Pagination Limits**: Hard cap at 100 items per page
5. **ID Validation**: Non-numeric IDs rejected with 400

---

## Database Interactions

### GET /api/admin/telegram
1. Check table existence
2. Query message stats (COUNT with FILTER)
3. Count filtered messages
4. Fetch paginated messages with user joins

### POST /api/admin/telegram/send
1. Find user by telegram_user_id
2. Check table existence
3. Create table if needed
4. Insert new message
5. Log audit action

### POST /api/admin/telegram/[id]/retry
1. Select message by ID
2. Update message (status, retry_count, error_message)
3. Log audit action

---

## Test Execution

```bash
# Run all telegram tests
npm test -- tests/unit/api/admin/telegram.test.ts

# Run with coverage
npm test -- tests/unit/api/admin/telegram.test.ts --coverage

# Run specific test
npm test -- tests/unit/api/admin/telegram.test.ts -t "should retry failed message"
```

---

## Future Test Improvements

1. **Permission-Based Tests**: Add tests for telegram.view, telegram.send, telegram.retry permissions
2. **Concurrent Retries**: Test race conditions when multiple admins retry same message
3. **Large Dataset**: Test performance with 1000+ messages in queue
4. **Complex Filters**: Test combining status + date range filters
5. **Message Payload**: Test different message types (text, photo, etc.)

---

## Metrics

- **Test Coverage:** 100% of endpoints
- **Success Scenarios:** 15 tests
- **Error Scenarios:** 12 tests
- **Validation Scenarios:** 4 tests
- **Pass Rate:** 31/31 (100%)
- **Flaky Tests:** 0
- **Execution Time:** 3.34s (well under 10min target)

---

## Related Files

- **Implementation:** `app/api/admin/telegram/route.ts`
- **Implementation:** `app/api/admin/telegram/send/route.ts`
- **Implementation:** `app/api/admin/telegram/[id]/retry/route.ts`
- **Test File:** `tests/unit/api/admin/telegram.test.ts`
- **Types:** `lib/admin/types.ts` (TelegramQueueStats, TelegramQueueMessage)
- **Session:** `lib/admin/session.ts` (getCurrentSession)
- **Audit:** `lib/admin/audit.ts` (logAdminAction)
