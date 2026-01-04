# Test Report: Admin Logs API

## Summary

**File:** `tests/unit/api/admin/logs.test.ts`
**Route:** `GET /api/admin/logs`
**Tests Created:** 40
**Status:** ✅ All passing

## Test Coverage

### 1. Authentication (2 tests)
- ✅ Return 401 without session
- ✅ Proceed with valid session

### 2. Default Pagination (2 tests)
- ✅ Use default page=1 and limit=20
- ✅ Return paginated logs with default settings

### 3. Level Filtering (5 tests)
- ✅ Filter by level=error
- ✅ Filter by level=warning
- ✅ Filter by level=info
- ✅ Default to level=all
- ✅ Fallback to all for invalid level

### 4. Date Range Filtering (4 tests)
- ✅ Filter by dateFrom
- ✅ Filter by dateTo
- ✅ Filter by date range (dateFrom and dateTo)
- ✅ Handle missing date params (null)

### 5. User ID Filtering (4 tests)
- ✅ Filter by userId (telegram_user_id)
- ✅ Handle invalid userId (non-numeric)
- ✅ Handle missing userId (null)
- ✅ Parse userId as integer

### 6. Search Filtering (3 tests)
- ✅ Filter by search keyword
- ✅ Handle missing search param (undefined)
- ✅ Handle empty search string

### 7. Pagination (7 tests)
- ✅ Paginate with page=2
- ✅ Paginate with limit=50
- ✅ Enforce minimum page=1
- ✅ Enforce minimum page=1 for negative values
- ✅ Enforce maximum limit=100
- ✅ Enforce minimum limit=1 (defaults to 20 for 0)
- ✅ Handle invalid page (non-numeric)
- ✅ Handle invalid limit (non-numeric)

### 8. Event Data Structure (3 tests)
- ✅ Return logs with user info (telegram_id, ip_address)
- ✅ Return logs with event metadata (tags, context)
- ✅ Handle events without user info

### 9. Empty Results (1 test)
- ✅ Return empty array when no logs found

### 10. Error Handling - Sentry API Errors (7 tests)
- ✅ Handle Sentry not configured error (503)
- ✅ Handle Sentry authentication failed error (401)
- ✅ Handle Sentry access denied error (403)
- ✅ Handle Sentry project not found error (404)
- ✅ Handle generic Sentry API error (500)
- ✅ Include debug info in error response
- ✅ Handle missing environment variables in debug info

### 11. Combined Filters (1 test)
- ✅ Apply all filters together (level, dates, userId, search, pagination)

## Test Execution

```bash
npm test -- tests/unit/api/admin/logs.test.ts
```

**Results:**
```
Test Suites: 1 passed, 1 total
Tests:       40 passed, 40 total
Time:        ~6 seconds
```

## Key Features Tested

### Query Parameters
- `level`: error | warning | info | all
- `dateFrom`: ISO timestamp
- `dateTo`: ISO timestamp
- `userId`: telegram_user_id (numeric)
- `search`: keyword search
- `page`: page number (min: 1)
- `limit`: items per page (min: 1, max: 100, default: 20)

### Response Format
```typescript
{
  success: true,
  data: {
    events: SentryEvent[],
    totalPages: number,
    currentPage: number,
    totalEvents: number
  }
}
```

### Error Responses
- **401 Unauthorized:** No admin session
- **401 Sentry Auth Failed:** Invalid SENTRY_AUTH_TOKEN
- **403 Sentry Access Denied:** Token lacks permissions
- **404 Sentry Project Not Found:** Invalid SENTRY_ORG or SENTRY_PROJECT
- **500 Generic Error:** Network/API failures
- **503 Sentry Not Configured:** Missing environment variables

### Event Structure
```typescript
interface SentryEvent {
  id: string
  eventID: string
  message: string
  level: 'error' | 'warning' | 'info' | 'debug'
  timestamp: string // ISO 8601
  user?: {
    id?: string
    telegram_id?: number
    username?: string
    ip_address?: string
  }
  tags?: Record<string, string>
  context?: Record<string, unknown>
  platform?: string
  culprit?: string
}
```

## Mocking Strategy

### Dependencies Mocked
1. **`@/lib/admin/session`**
   - `getCurrentSession()` - Admin authentication

2. **`@/lib/admin/sentry-api`**
   - `fetchSentryEvents()` - Sentry API client

### Mock Implementation
```typescript
const mockGetCurrentSession = jest.fn()
const mockFetchSentryEvents = jest.fn()

jest.mock('@/lib/admin/session', () => ({
  getCurrentSession: mockGetCurrentSession,
}))

jest.mock('@/lib/admin/sentry-api', () => ({
  fetchSentryEvents: mockFetchSentryEvents,
}))
```

### Test Helper
```typescript
function createRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/admin/logs')
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })
  return new NextRequest(url)
}
```

## Edge Cases Covered

### Input Validation
- Invalid level values → defaults to 'all'
- Negative page numbers → enforced to minimum 1
- Zero page → enforced to minimum 1
- Limit > 100 → capped at 100
- Limit = 0 → defaults to 20
- Non-numeric userId → treated as null
- Empty search string → treated as undefined

### Data Handling
- Missing date parameters → null
- Missing user info in events → undefined user field
- Empty results → empty array with totalEvents=0
- Missing environment variables → NOT_SET in debug info

### Error Scenarios
- Sentry API connection failures
- Authentication failures
- Authorization failures
- Configuration errors
- Network timeouts

## Implementation Notes

### Behavior Clarifications
1. **Date parameters:** `searchParams.get()` returns `null` when missing (not `undefined`)
2. **Limit validation:** When `limit='0'`, `parseInt('0')` = 0 (falsy), defaults back to 20
3. **Search parameter:** Empty string `''` is converted to `undefined` via `|| undefined`

### Debug Information
Error responses include debug info:
```typescript
debug: {
  org: process.env.SENTRY_ORG || 'NOT_SET',
  project: process.env.SENTRY_PROJECT || 'NOT_SET',
  hasAuthToken: !!process.env.SENTRY_AUTH_TOKEN
}
```

## Integration with Sentry

### Environment Variables Required
```env
SENTRY_AUTH_TOKEN=your-auth-token
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

### API Endpoint
```
https://sentry.io/api/0/projects/{org}/{project}/events/
```

### Query Building
The route delegates query building to `buildSentryQuery()` from `@/lib/admin/sentry-api`, which constructs:
- `query`: level, userId (tags), search (message)
- `start/end`: date range
- `statsPeriod`: default 14d if no dates provided
- `per_page`: pagination limit

## Related Files

- **Route:** `app/api/admin/logs/route.ts`
- **Sentry Client:** `lib/admin/sentry-api.ts`
- **Session:** `lib/admin/session.ts`
- **Types:** `lib/admin/types.ts`

## Future Enhancements

Potential test additions:
1. Performance tests for large result sets
2. Concurrent request handling
3. Rate limiting behavior
4. Cursor-based pagination (Sentry uses cursors, not offset)
5. Integration tests with real Sentry API (test environment)

---

**Created:** 2025-12-31
**Test Framework:** Jest
**Coverage:** Comprehensive unit testing of all route functionality
