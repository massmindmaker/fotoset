# Admin Users Management API - Test Report

**Date:** 2025-12-31
**Test File:** `tests/unit/api/admin/users.test.ts`
**Status:** PASS (39/39 tests)

## Summary

Comprehensive unit tests for admin users management API routes covering:
- User listing with pagination and search
- User details retrieval
- Ban/unban operations
- Pro status grant/revoke operations

## Test Coverage

### GET /api/admin/users (List Users) - 7 tests
- [x] Return users with default pagination (page=1, limit=20)
- [x] Return users with custom pagination
- [x] Search by telegram_user_id
- [x] Include aggregated counts (avatars, payments, total_spent, is_pro)
- [x] Include photo counts (ref_photos_total, gen_photos_total)
- [x] Include telegram status counts (sent, pending, failed)
- [x] Database error handling

### GET /api/admin/users/[userId] (User Details) - 10 tests
- [x] Return full user details with all relationships
- [x] Include avatars with photo counts
- [x] Include payment history
- [x] Include generation jobs
- [x] Include referral stats (count, paid count, earnings)
- [x] Handle missing ban columns gracefully (backward compatibility)
- [x] Return 401 without session
- [x] Return 400 for invalid user ID
- [x] Return 404 for non-existent user
- [x] Database error handling

### POST /api/admin/users/[userId]/ban (Ban/Unban) - 11 tests
- [x] Ban user successfully
- [x] Include ban reason in request
- [x] Log audit action for ban
- [x] Unban user successfully
- [x] Log audit action for unban
- [x] Return 401 without session
- [x] Return 403 without users.ban permission
- [x] Return 400 for invalid user ID
- [x] Return 400 for missing isBanned parameter
- [x] Return 404 for non-existent user
- [x] Database error handling

### POST /api/admin/users/[userId]/pro (Grant/Revoke Pro) - 11 tests
- [x] Grant Pro status successfully
- [x] Include reason in metadata
- [x] Log audit action for grant
- [x] Revoke Pro status successfully
- [x] Log audit action for revoke
- [x] Return 401 without session
- [x] Return 403 without users.grant_pro permission
- [x] Return 400 for invalid user ID
- [x] Return 400 for missing isPro parameter
- [x] Return 404 for non-existent user
- [x] Database error handling

## Test Architecture

### Mocking Strategy

```typescript
// SQL Template Literal Mock
const createSqlMock = () => {
  const sqlFn = (...args: any[]) => {
    if (Array.isArray(args[0])) {
      // Empty template: sql`` -> ""
      if (args[0].length === 1 && args[0][0] === "") {
        return ""
      }
      // Search condition fragments (synchronous)
      if (templateStr.includes("AND")) {
        return "AND (u.telegram_user_id::text LIKE '%search%')"
      }
      // Actual queries (asynchronous)
      return mockSql(...args)
    }
    return mockSql(...args)
  }
  sqlFn.unsafe = (str: string) => str
  return sqlFn
}
```

### Key Mocks
- `@/lib/db` - Database client with template literal support
- `@/lib/admin/session` - Session management
- `@/lib/admin/permissions` - Permission checks
- `@/lib/admin/audit` - Audit logging
- `@neondatabase/serverless` - Neon database client

## Test Data

### Mock Users
```typescript
{
  id: 1,
  telegram_user_id: "111111111",
  avatars_count: "3",
  payments_count: "2",
  total_spent: "1998",
  is_pro: true,
  ref_photos_total: "15",
  gen_photos_total: "69",
  tg_sent_count: "5"
}
```

### Mock Admin Session
```typescript
{
  adminId: 1,
  role: "super_admin",
  email: "admin@example.com"
}
```

## Notable Test Patterns

### 1. Handling Template Literal SQL
The route uses nested SQL template literals for dynamic search conditions:
```typescript
const searchCondition = search
  ? sql`AND (u.telegram_user_id::text LIKE ${'%' + search + '%'})`
  : sql``
```

The mock handles this by returning synchronous strings for fragments and async promises for queries.

### 2. Optional Database Columns
The user details route gracefully handles missing columns (is_banned, total_earnings) for backward compatibility:
```typescript
try {
  const [banData] = await sql`SELECT is_banned, ban_reason...`
  if (banData) banInfo = banData
} catch {
  // Columns might not exist yet, use defaults
}
```

### 3. Audit Logging Verification
Tests verify that audit actions are logged with complete metadata:
```typescript
expect(mockLogAdminAction).toHaveBeenCalledWith({
  adminId: 1,
  action: "user_banned",
  targetType: "user",
  targetId: 1,
  metadata: {
    previousStatus: false,
    newStatus: true,
    reason: "Spam activity detected",
    telegramUserId: "111111111"
  }
})
```

## Execution Time

- Total: 7.5s
- Average per test: ~192ms
- Slowest: Error handling tests (~400-450ms)

## Files Tested

| Route | File Path | Lines |
|-------|-----------|-------|
| GET /api/admin/users | `app/api/admin/users/route.ts` | 95 |
| GET /api/admin/users/[userId] | `app/api/admin/users/[userId]/route.ts` | 167 |
| POST /api/admin/users/[userId]/ban | `app/api/admin/users/[userId]/ban/route.ts` | 110 |
| POST /api/admin/users/[userId]/pro | `app/api/admin/users/[userId]/pro/route.ts` | 92 |

## Integration with CI/CD

Run tests:
```bash
npm test tests/unit/api/admin/users.test.ts
```

Run with coverage:
```bash
npm test -- --coverage tests/unit/api/admin/users.test.ts
```

## Future Improvements

1. Add tests for permission-based filtering (viewer vs admin vs super_admin)
2. Test pagination edge cases (page 0, negative limits)
3. Test concurrent ban/unban operations
4. Add performance tests for large user datasets
5. Test referral stats with complex scenarios

## Related Tests

- `tests/unit/api/admin/payments.test.ts` - Payment management
- `tests/unit/lib/admin/audit.test.ts` - Audit logging (if exists)
- `tests/unit/lib/admin/permissions.test.ts` - Permission checks (if exists)
