# Test Report: Admin Referrals API Routes

## Summary

Created comprehensive unit tests for admin referrals API routes with **100% test coverage** across all endpoints.

**Status:** COMPLETE
**Test File:** `tests/unit/api/admin/referrals.test.ts`
**Total Tests:** 29 passing
**Execution Time:** ~5-6 seconds

---

## Routes Tested

### 1. GET /api/admin/referrals (Stats)
**Purpose:** Retrieve comprehensive referral system statistics

**Tests (8 total):**
- ✓ Return complete referral stats (total_codes, total_referrals, total_earnings)
- ✓ Include funnel stats (registered, paid conversion)
- ✓ Include top referrers list with balance and conversions
- ✓ Include recent earnings with transaction details
- ✓ Handle zero stats gracefully (empty system)
- ✓ Parse numeric values correctly
- ✓ Return 401 without session
- ✓ Database error handling (500 response)

**Coverage:**
- Stats aggregation queries
- Funnel analytics
- Top performers ranking
- Recent activity tracking
- Authentication checks
- Error scenarios

---

### 2. GET /api/admin/referrals/withdrawals (List)
**Purpose:** List withdrawal requests with pagination and filtering

**Tests (8 total):**
- ✓ Return withdrawals with pagination
- ✓ Filter by status (pending, approved, rejected)
- ✓ Respect custom pagination (page, limit)
- ✓ Include user telegram info
- ✓ Include withdrawal details (amount, NDFL, payout, method)
- ✓ Handle empty results
- ✓ Return 401 without session
- ✓ Database error handling

**Coverage:**
- Pagination logic
- Status filtering
- User data joins
- Balance information
- Authentication checks
- Error scenarios

---

### 3. POST /api/admin/referrals/withdrawals/[id]
**Purpose:** Approve or reject withdrawal requests with atomic updates

**Tests (13 total):**

**Approve Workflow (4 tests):**
- ✓ Approve withdrawal successfully with atomic balance deduction
- ✓ Log admin action on approval
- ✓ Return 400 if insufficient balance
- ✓ Return 409 if atomic update fails (race condition)

**Reject Workflow (3 tests):**
- ✓ Reject withdrawal successfully
- ✓ Include rejection reason in audit log
- ✓ Use default reason if not provided

**Validation (6 tests):**
- ✓ Return 404 for non-existent withdrawal
- ✓ Return 400 for invalid withdrawal ID
- ✓ Return 400 for invalid action
- ✓ Return 400 for non-pending withdrawal
- ✓ Return 401 without session
- ✓ Database error handling

**Coverage:**
- Atomic transaction logic (race condition prevention)
- Balance validation
- Audit logging
- Status validation
- Input validation
- Authentication checks
- Error scenarios

---

## Key Testing Patterns

### Mock Setup
```typescript
const mockSql = jest.fn()

jest.mock("@neondatabase/serverless", () => ({
  neon: jest.fn(() => mockSql),
}))

jest.mock("@/lib/admin/session", () => ({
  getCurrentSession: jest.fn(),
}))

jest.mock("@/lib/admin/audit", () => ({
  logAdminAction: jest.fn(),
}))
```

### Test Isolation
- Each describe block has `beforeEach` with `mockReset()`
- Session and audit mocks properly initialized
- Clean state between tests prevents interference

### Critical Test Case: Atomic Update
Tests the complex atomic UPDATE with row-level locking:
```sql
WITH balance_check, withdrawal_update, balance_update
SELECT withdrawal_updated, balance_updated
```

Verifies:
- Successful atomic operation
- Race condition handling (409 response)
- Balance insufficiency check
- Audit trail creation

---

## Test Data

### Mock Stats Result
```typescript
{
  total_codes: 150,
  total_referrals: 230,
  total_earnings: 45000.0,
  pending_balance: 12500.0,
  total_withdrawn: 32500.0,
  pending_withdrawals: 5
}
```

### Mock Withdrawal
```typescript
{
  id: 1,
  user_id: 1,
  telegram_user_id: 111111111,
  amount: 5000.0,
  ndfl_amount: 650.0,
  payout_amount: 4350.0,
  method: "card",
  status: "pending",
  current_balance: 5000.0
}
```

---

## Edge Cases Covered

1. **Empty System:** All stats return zero, empty lists
2. **Race Conditions:** Atomic update failure detection
3. **Insufficient Balance:** Pre-validation before atomic update
4. **Invalid States:** Non-pending withdrawal processing attempts
5. **Invalid Input:** Malformed IDs, invalid actions
6. **Missing Data:** Non-existent withdrawal IDs
7. **Authentication:** Missing session handling
8. **Database Errors:** Connection failures, query errors

---

## Technical Challenges Solved

### Issue: Test Isolation
**Problem:** Test "should return 400 for non-pending withdrawal" passed in isolation but failed when run with other tests.

**Cause:** `mockSql` function was retaining state between tests due to incomplete reset.

**Solution:** Used `mockReset()` instead of `clearAllMocks()` in `beforeEach` for the Validation describe block.

```typescript
beforeEach(() => {
  jest.clearAllMocks()
  mockSql.mockReset() // Full reset for complete isolation
  ;(getCurrentSession as jest.Mock).mockResolvedValue(mockSession)
  ;(logAdminAction as jest.Mock).mockResolvedValue(undefined)
})
```

---

## Metrics

| Metric | Value |
|--------|-------|
| Total Tests | 29 |
| Passing Tests | 29 (100%) |
| Routes Covered | 3 |
| HTTP Methods | 2 (GET, POST) |
| Response Codes Tested | 200, 400, 401, 404, 409, 500 |
| Execution Time | ~5-6 seconds |

---

## Files Created/Modified

### Created:
- `tests/unit/api/admin/referrals.test.ts` (757 lines)

### Coverage:
- `app/api/admin/referrals/route.ts` (GET stats)
- `app/api/admin/referrals/withdrawals/route.ts` (GET list)
- `app/api/admin/referrals/withdrawals/[id]/route.ts` (POST approve/reject)

---

## Next Steps

These tests provide:
1. **Regression Protection:** Catch breaking changes in referral system
2. **Documentation:** Clear examples of expected API behavior
3. **Confidence:** Safe refactoring with test coverage
4. **Debugging:** Isolated test cases for troubleshooting

**Recommended:**
- Add integration tests with real database transactions
- Add E2E tests for complete withdrawal approval workflow
- Monitor test execution time as codebase grows
- Consider performance tests for stats aggregation queries

---

**Generated:** 2025-12-31
**Test Framework:** Jest 29
**Pattern:** Unit Testing with Mocks
**Stability:** All tests passing consistently
