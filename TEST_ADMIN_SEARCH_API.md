# Admin Search API - Unit Test Report

**File:** `tests/unit/api/admin/search.test.ts`
**Route:** `app/api/admin/search/route.ts` (GET)
**Tests:** 28 passed
**Coverage:** Comprehensive

---

## Summary

Created complete unit test suite for the admin global search API endpoint. All 28 tests passing successfully.

**Test Coverage:**
- Authentication & Authorization
- Query Validation
- Multi-entity Search (Users, Payments, Generations, Referrals)
- Result Limiting & Pagination
- SQL Injection Prevention
- Result Sorting & Deduplication
- Error Handling
- Response Format Validation

---

## Test Breakdown

### 1. Authentication (1 test)
- [x] Returns 401 when no session exists

### 2. Query Validation (3 tests)
- [x] Returns empty results when query is missing
- [x] Returns empty results when query is too short (< 2 chars)
- [x] Trims whitespace from query

### 3. User Search - Numeric Query (2 tests)
- [x] Searches users by telegram_user_id
- [x] Includes free users in results (Pro vs Free status)

### 4. Payment Search (3 tests)
- [x] Searches payments by tbank_payment_id (numeric)
- [x] Searches payments by tbank_payment_id (alphanumeric)
- [x] Handles payment without telegram_user_id (NULL user)

### 5. Generation Search (2 tests)
- [x] Searches generations by job ID
- [x] Calculates progress correctly for partial generation (10/23 photos)

### 6. Referral Search (2 tests)
- [x] Searches referral codes (3+ chars)
- [x] Does not search referrals for queries < 3 chars

### 7. Mixed Results (1 test)
- [x] Returns mixed results from all entity types

### 8. Result Limiting (3 tests)
- [x] Applies default limit of 10
- [x] Respects custom limit parameter
- [x] Enforces max limit of 50

### 9. SQL Injection Prevention (3 tests)
- [x] Escapes % characters in LIKE patterns
- [x] Escapes _ characters in LIKE patterns
- [x] Escapes backslash characters

### 10. Result Sorting (1 test)
- [x] Sorts exact matches first

### 11. Empty Results (1 test)
- [x] Returns empty results when nothing found

### 12. Error Handling (3 tests)
- [x] Handles database errors gracefully (500 response)
- [x] Handles missing DATABASE_URL
- [x] Handles SQL query failures

### 13. Response Format (2 tests)
- [x] Includes query and total in response
- [x] Includes all required fields in search results

### 14. Deduplication (1 test)
- [x] Does not duplicate payments found in both numeric and alphanumeric searches

---

## Search Logic Tested

### Numeric Queries (`/^\d+$/`)
1. Search users by `telegram_user_id` (LIKE prefix match)
2. Search payments by ID or `tbank_payment_id` (LIKE prefix match)
3. Search generation jobs by ID (exact match)

### Alphanumeric Queries (3+ chars)
1. Search payments by `tbank_payment_id` (ILIKE substring match)
2. Search referral codes (ILIKE substring match)

---

## Key Test Patterns

### Mock Setup
```typescript
const mockSql = jest.fn().mockResolvedValue([])
const mockGetCurrentSession = getCurrentSession as jest.MockedFunction<...>

beforeEach(() => {
  mockSql = jest.fn().mockResolvedValue([])
  mockNeon.mockReturnValue(mockSql as any)
  process.env.DATABASE_URL = 'postgresql://test'
})
```

### Query Chaining
```typescript
mockSql
  .mockResolvedValueOnce([users])      // First query
  .mockResolvedValueOnce([payments])   // Second query
  .mockResolvedValueOnce([generations]) // Third query
```

### Result Validation
```typescript
expect(data.results).toContainEqual({
  type: 'user',
  id: 5,
  title: 'User 123456789',
  subtitle: 'Pro · 2 платежей',
  url: '/admin/users?user=5',
  meta: { telegram_user_id: 123456789, is_pro: true }
})
```

---

## Security Features Tested

### 1. SQL Injection Prevention
- LIKE pattern escaping (`%`, `_`, `\`)
- Parameterized queries via Neon SQL
- Input sanitization

### 2. Authentication
- Session validation on all requests
- 401 for unauthenticated users

### 3. Input Validation
- Query length requirements (min 2 chars)
- Limit bounds enforcement (max 50)

---

## Response Schema

```typescript
{
  results: SearchResult[],
  query: string,
  total: number
}

interface SearchResult {
  type: 'user' | 'payment' | 'generation' | 'referral'
  id: number
  title: string
  subtitle: string
  url: string
  meta?: Record<string, unknown>
}
```

---

## Edge Cases Covered

1. **NULL Values:** Payment without telegram_user_id → "User N/A"
2. **Progress Calculation:** 10/23 photos → 0.435 progress
3. **Short Queries:** < 2 chars → empty results
4. **Missing Query:** No `?q=` param → empty results
5. **Whitespace:** `"  12345  "` → trimmed to `"12345"`
6. **Database Errors:** Connection failures → 500 response
7. **Missing Config:** No DATABASE_URL → 500 response
8. **Deduplication:** Same payment in multiple searches → single result
9. **Max Limit:** `?limit=100` → capped at 50

---

## Performance Considerations

### Default Limits
- **Default:** 10 results
- **Maximum:** 50 results
- **Minimum query length:** 2 characters (referrals require 3+)

### Query Optimization
- Users: `LEFT JOIN` payments for count
- Payments: Indexed on `tbank_payment_id`
- Generations: Indexed on `id`
- Referrals: `GROUP BY` for referral count

---

## Files Created

```
tests/unit/api/admin/search.test.ts  (689 lines, 28 tests)
```

---

## Running Tests

```bash
# Run tests
npm test -- tests/unit/api/admin/search.test.ts

# Run with coverage
npm test -- tests/unit/api/admin/search.test.ts --coverage

# Watch mode
npm test -- tests/unit/api/admin/search.test.ts --watch
```

---

## Test Execution Time

**Total:** ~7 seconds
**Average per test:** ~250ms

---

## Integration Points

### Dependencies
- `@neondatabase/serverless` - Database client
- `@/lib/admin/session` - Authentication
- `next/server` - Request/Response handling

### Database Tables
- `users` (telegram_user_id, is_pro)
- `payments` (tbank_payment_id, amount, status)
- `generation_jobs` (status, completed_photos, total_photos)
- `referral_codes` (code, user_id)
- `avatars` (name)
- `referrals` (referrer_id)

---

## Future Enhancements

1. **Fuzzy Search:** Implement Levenshtein distance for typo tolerance
2. **Search Filters:** Add status, date range, Pro/Free filters
3. **Pagination:** Cursor-based pagination for large result sets
4. **Caching:** Redis cache for frequent searches
5. **Search Analytics:** Track popular queries
6. **Autocomplete:** Real-time suggestions as user types
7. **Export:** CSV/JSON export of search results

---

## Related Tests

- `tests/unit/api/admin/users/[userId]/route.test.ts` - User details
- `tests/unit/api/admin/payments/[paymentId]/route.test.ts` - Payment details
- `tests/unit/api/admin/generations/route.test.ts` - Generation list
- `tests/unit/api/admin/referrals/route.test.ts` - Referral management

---

**Status:** ✅ All 28 tests passing
**Created:** 2025-12-31
**Time:** ~6 minutes
