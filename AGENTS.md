# AGENTS.md - PinGlass Coding Agent Instructions

> AI coding agents: Read this file first before making any changes.

## Quick Reference

```bash
# Development
pnpm dev                          # Start dev server (Turbopack)
pnpm build                        # Production build
pnpm lint                         # ESLint with PinGlass rules

# Testing
pnpm test                         # All Jest tests
pnpm test -- path/to/file.test.ts # Single test file
pnpm test -- -t "test name"       # Single test by name
pnpm test:unit                    # Unit tests with coverage
pnpm test:integration             # Integration tests (sequential)
pnpm test:e2e                     # Playwright E2E tests
pnpm test:e2e -- path/to/spec.ts  # Single E2E spec
```

---

## Critical Anti-Patterns (ESLint Enforced)

These will **FAIL lint** and block commits:

```typescript
// ERROR: No user status flags exist in this app
user.isPro           // NO - status doesn't exist
user.is_pro          // NO - status doesn't exist  
user_is_pro          // NO - status doesn't exist

// Access = successful payment, NOT a status field
// Check: SELECT COUNT(*) FROM payments WHERE user_id=? AND status='succeeded'

// ERROR: Wrong table name
"FROM telegram_queue"    // NO - table doesn't exist
"INTO telegram_queue"    // NO - use telegram_message_queue instead

// WARNING: Hardcoded prices
const price = 499        // Use pricing_tiers table or admin API

// WARNING: Missing RETURNING clause
"UPDATE payments SET..." // Add RETURNING * for updated data
```

---

## Naming Conventions

| Context | Convention | Example |
|---------|------------|---------|
| Database columns | snake_case | `telegram_user_id`, `created_at` |
| TypeScript variables | camelCase | `telegramUserId`, `createdAt` |
| API query params | snake_case | `?telegram_user_id=123` |
| API request/response | camelCase | `{ telegramUserId: 123 }` |
| Environment vars | SCREAMING_SNAKE | `DATABASE_URL` |
| React components | PascalCase | `PaymentModal` |
| CSS classes | kebab-case | `payment-modal` |

---

## Import Order

```typescript
// 1. Framework/external imports
import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

// 2. Internal lib imports (use @ alias)
import { sql, query } from "@/lib/db"
import { success, error, createLogger } from "@/lib/api-utils"

// 3. Types (inline interface or import)
interface RequestBody {
  userId: number
  styleId: string
}
```

---

## API Route Pattern

```typescript
import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { success, error, validateRequired, createLogger } from "@/lib/api-utils"

const logger = createLogger("RouteName")

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const validation = validateRequired(body, ["userId", "avatarId"])
    if (!validation.valid) {
      return error("VALIDATION_ERROR", validation.error!)
    }

    // Database query with parameterized values
    const result = await sql`
      SELECT * FROM users WHERE id = ${body.userId}
    `

    // Success response
    return success({ user: result[0] })

  } catch (err) {
    logger.error("Operation failed", err)
    return error("INTERNAL_ERROR", "Operation failed")
  }
}
```

---

## Database Patterns

```typescript
// Tagged template (preferred for simple queries)
const users = await sql`
  SELECT * FROM users WHERE telegram_user_id = ${telegramId}
`

// Parameterized query (for complex/dynamic queries)
const { rows } = await query<User>(
  "SELECT * FROM users WHERE id = $1 AND status = $2",
  [userId, status]
)

// Always use RETURNING for mutations
await sql`
  UPDATE payments SET status = 'succeeded'
  WHERE id = ${paymentId}
  RETURNING *
`
```

---

## Type Definitions

Define types in `lib/db.ts` for database models:

```typescript
export type User = {
  id: number
  telegram_user_id: number | null
  telegram_username: string | null
  created_at: string
  updated_at: string
}

export type Payment = {
  id: number
  user_id: number
  status: "pending" | "succeeded" | "canceled" | "refunded"
  amount: string  // DECIMAL comes as string
  created_at: string
}
```

---

## Error Handling

Use typed error codes from `lib/api-utils.ts`:

```typescript
// Client errors
return error("VALIDATION_ERROR", "Missing required field")
return error("UNAUTHORIZED", "Authentication required")
return error("NOT_FOUND", "User not found")
return error("PAYMENT_REQUIRED", "Payment required for this action")

// Server errors  
return error("INTERNAL_ERROR", "Unexpected error occurred")
return error("DATABASE_ERROR", "Database operation failed")
return error("EXTERNAL_API_ERROR", "External service unavailable")
```

---

## Logging Pattern

```typescript
import { createLogger } from "@/lib/api-utils"

const logger = createLogger("ModuleName")

logger.info("Operation started", { userId, avatarId })
logger.warn("Retry attempt", { attempt: 2, maxRetries: 3 })
logger.error("Operation failed", error)
```

---

## Testing

### File Structure
```
tests/
├── unit/           # Jest unit tests (jsdom)
├── integration/    # Jest integration (node, needs DB)
└── e2e/            # Playwright browser tests
```

### Running Tests
```bash
# Single test file
pnpm test -- tests/unit/lib/tbank.test.ts

# Tests matching pattern
pnpm test -- -t "should verify signature"

# With coverage
pnpm test:unit -- --coverage

# E2E single spec
pnpm test:e2e -- tests/e2e/payment.spec.ts

# E2E headed (visible browser)
pnpm test:e2e:headed -- tests/e2e/payment.spec.ts
```

### Test Pattern
```typescript
import { describe, it, expect, beforeEach, jest } from "@jest/globals"

describe("FunctionName", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should do expected behavior", async () => {
    const result = await functionUnderTest(input)
    expect(result).toEqual(expected)
  })
})
```

---

## Async Generation Pattern

**NEVER use synchronous generation** (Cloudflare 100s timeout):

```typescript
// WRONG - will timeout
const photos = await generateAndWait(prompt)

// CORRECT - fire and forget + polling
await publishGenerationJob({ jobId, avatarId })
// Cron job polls kie_tasks table for completion
```

---

## Key Files

| File | Purpose |
|------|---------|
| `components/persona-app.tsx` | Main app component (~1100 lines) |
| `lib/db.ts` | Database client + type definitions |
| `lib/api-utils.ts` | API response helpers, error codes |
| `lib/tbank.ts` | T-Bank payment integration |
| `lib/prompts.ts` | 23 generation prompts + styles |
| `app/api/generate/route.ts` | Core generation endpoint |

---

## Partner Packs System

Partners can create custom style packs with AI prompts for the marketplace.

### Partner Authentication
- Login via `/partner/login` with email/password
- Session stored in `partner_session` cookie (7 days)
- Partner status: `referral_balances.is_partner = true`

### Partner Pack Workflow
```
CREATE (draft) → ADD PROMPTS → SUBMIT → ADMIN REVIEW → APPROVED/REJECTED
```

### Key Files
| File | Purpose |
|------|---------|
| `app/partner/` | Partner UI pages |
| `app/api/partner/packs/` | Partner packs CRUD API |
| `lib/partner/session.ts` | Partner session management |
| `lib/pack-helpers.ts` | Pack preview image helpers |
| `components/partner/PartnerTestBlock.tsx` | Prompt tester component |

### Prompt Tester
Partners can test prompts before adding to pack:
- **Quota:** 200 test generations per partner
- **Stored in:** `referral_balances.test_generations_used`
- **Preview images:** Auto-copied to R2 on save

### R2 Preview Storage
External preview URLs (from Kie.ai) are automatically copied to R2:
- **Path:** `previews/pack-{packId}/prompt-{promptId}-{timestamp}.jpg`
- **Triggered on:** POST/PUT to `/api/partner/packs/[id]/prompts`
- **Function:** `uploadFromUrl()` from `lib/r2.ts`

### Pack Editor Features
- 3-column layout: prompts list, editor, test area
- Autosave draft to localStorage (1s debounce, 24h expiry)
- Blob download for test images (prevents navigation)

---

## OpenSpec Workflow

For new features, create a proposal first:

```bash
mkdir -p openspec/changes/<feature-name>/specs

# Create:
# - proposal.md   (why and what)
# - tasks.md      (implementation checklist)
# - specs/*.md    (spec deltas)
```

See `openspec/AGENTS.md` for detailed workflow.

---

## Environment Setup

Required variables in `.env.local`:

```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_APP_URL=https://...
KIE_API_KEY=...
TBANK_TERMINAL_KEY=...
TBANK_PASSWORD=...
```
