# MCP Best Practices - PinGlass (Fotoset)

## Overview

This document outlines proven patterns and best practices for using MCP servers effectively in the PinGlass project. These patterns are based on real-world usage and optimization metrics.

---

## Table of Contents

1. [Token Optimization](#token-optimization)
2. [Time Efficiency](#time-efficiency)
3. [Cost Management](#cost-management)
4. [Error Handling](#error-handling)
5. [Security Best Practices](#security-best-practices)
6. [Workflow Integration](#workflow-integration)
7. [Testing Strategies](#testing-strategies)
8. [Documentation Patterns](#documentation-patterns)

---

## Token Optimization

### Pattern 1: Serena Progressive Drill-Down (80% savings)

**Situation:** Need to understand a large file (>100 lines)

**Anti-Pattern:**
```
❌ Read entire persona-app.tsx (1059 lines) → 10,000+ tokens
```

**Best Practice:**
```
✅ Step 1: get_symbols_overview("components/persona-app.tsx")
   Result: See all 12 views, 8 handlers, 15 types → 500 tokens

✅ Step 2: find_symbol("handlePayment", include_body=false)
   Result: Function signature only → 50 tokens

✅ Step 3: find_symbol("handlePayment", include_body=true)
   Result: Implementation details → 200 tokens

Total: 750 tokens (92.5% savings)
```

**When to Use:**
- Files >100 lines
- Complex components (persona-app.tsx, API routes)
- Need to understand structure before diving deep

**Metrics:**
- Token savings: 60-90%
- Time saved: 40-60% (less content to read)
- Quality: Better context retention (focused attention)

---

### Pattern 2: Smart File Selection

**Situation:** Exploring codebase for relevant information

**Anti-Pattern:**
```
❌ Read all files in lib/ to find payment logic
   7 files × 300 lines avg = 2,100 lines = 21,000 tokens
```

**Best Practice:**
```
✅ Step 1: Glob("lib/*.ts") → See all files
✅ Step 2: Serena get_symbols_overview for each
✅ Step 3: Read only relevant files (tbank.ts, db.ts)

Total: 2,000 tokens (90% savings)
```

**Decision Tree:**
```
File size?
├─ <100 lines → Read tool (fast)
├─ 100-500 lines → Serena (overview → selective)
└─ >500 lines → Serena (progressive drill-down)

File type?
├─ .ts/.tsx → Serena (semantic analysis)
├─ .json/.md → Read (no parsing needed)
└─ .env → Read (small, sensitive)
```

---

### Pattern 3: Memory-Driven Context

**Situation:** Explaining complex concepts repeatedly

**Anti-Pattern:**
```
❌ Session 1: Explain T-Bank webhook flow (500 tokens)
❌ Session 2: Re-explain same flow (500 tokens)
❌ Session 3: Re-explain again (500 tokens)
Total: 1,500 tokens wasted
```

**Best Practice:**
```
✅ Session 1: Explain + Store in Memory
   Memory.store({
     "topic": "T-Bank webhook verification",
     "flow": "1. Receive POST 2. Verify SHA256 3. Update DB",
     "code": "app/api/payment/webhook/route.ts"
   })

✅ Session 2+: Memory.recall("T-Bank webhook")
   Result: Instant context (50 tokens)

Total savings: 1,450 tokens (97%)
```

**What to Store:**
- Complex flows (payment, generation)
- Debugging discoveries (bug root causes)
- API quirks (T-Bank signature format)
- User patterns (common issues)

---

## Time Efficiency

### Pattern 4: Parallel MCP Operations

**Situation:** Need multiple independent pieces of information

**Anti-Pattern (Sequential):**
```
❌ Task 1: Serena analyze persona-app.tsx (10s)
   WAIT for completion
❌ Task 2: Neon check payment status (5s)
   WAIT for completion
❌ Task 3: Exa search T-Bank docs (8s)

Total: 23 seconds
```

**Best Practice (Parallel):**
```
✅ Launch simultaneously:
   - Task 1: Serena analyze (10s)
   - Task 2: Neon check payment (5s)
   - Task 3: Exa search (8s)

Total: 10 seconds (57% faster)
```

**Implementation:**
```python
# Conceptual - MCP handles parallelism internally
results = await Promise.all([
  serena.get_symbols_overview("components/persona-app.tsx"),
  neon.query_table("payments", {status: "succeeded"}),
  exa.search("T-Bank webhook verification")
])
```

**When Safe to Parallelize:**
- ✅ Read operations (Serena, Neon queries)
- ✅ Independent searches (Exa, Context7)
- ✅ Health checks (Docker logs)
- ❌ Write operations (DB updates)
- ❌ Dependent operations (generate → test)

---

### Pattern 5: Context7 + Memory Caching

**Situation:** Looking up documentation repeatedly

**Anti-Pattern:**
```
❌ Every session:
   - Context7 query "Next.js 16 Server Actions" (3s)
   - Context7 query "React 19 use() hook" (3s)
   - Context7 query "Tailwind 4 OKLCH" (3s)

Total per session: 9 seconds
5 sessions = 45 seconds
```

**Best Practice:**
```
✅ First session:
   - Context7 query → Store in Memory
   - Tag with version number (Next.js 16)

✅ Subsequent sessions:
   - Memory.recall("Next.js 16 Server Actions") (0.5s)
   - Only re-query if docs outdated (check monthly)

Savings: 8.5s per session × 5 = 42.5 seconds (94%)
```

**Cache Invalidation:**
- Manual: When dependency versions change
- Automatic: Store timestamp, refresh after 30 days
- Hybrid: Check Context7 changelog before recall

---

### Pattern 6: Playwright Test Optimization

**Situation:** Running E2E tests for payment flow

**Anti-Pattern:**
```
❌ Full browser test every change:
   - Launch browser (5s)
   - Navigate to app (3s)
   - Upload photos (10s)
   - Click through payment (15s)
   - Wait for redirect (10s)
   - Verify result (5s)

Total: 48 seconds per test
10 runs = 8 minutes
```

**Best Practice:**
```
✅ Tiered testing:
   Level 1: Unit tests (lib/tbank.ts) → 0.5s
   Level 2: API tests (POST /api/payment/create) → 2s
   Level 3: E2E smoke test (happy path only) → 20s
   Level 4: Full E2E (weekly) → 48s

Daily: 0.5s + 2s + 20s = 22.5s (53% faster)
```

**Playwright Shortcuts:**
```javascript
// Skip upload, inject photos directly
await page.evaluate(() => {
  window.__TEST_PHOTOS__ = ['base64...'];
});

// Mock T-Bank redirect
await page.route('**/securepay.tinkoff.ru/**', route => {
  route.fulfill({
    status: 200,
    body: 'Payment successful'
  });
});

// Fast-forward generation
await page.evaluate(() => {
  window.__MOCK_GENERATION__ = true;
});
```

---

## Cost Management

### Pattern 7: Rate Limit Awareness

**Free Tier Limits:**
- Context7: 10 queries/day
- Exa: 1,000 queries/month
- Shadcn: 60 requests/hour (GitHub API)

**Anti-Pattern:**
```
❌ Query Context7 for every question
   - 15 queries in one session → Locked out for 24h
```

**Best Practice:**
```
✅ Batch questions:
   - Combine 3 related questions into 1 query
   - Use Memory cache for common questions
   - Fall back to Exa/WebSearch after limit

Example:
BAD: 3 queries
  1. "Next.js 16 Server Actions"
  2. "Next.js 16 form validation"
  3. "Next.js 16 error handling"

GOOD: 1 query
  "Next.js 16 Server Actions best practices including form validation and error handling"
```

**Rate Limit Mitigation:**
```javascript
// Track usage
memory.store({
  "context7_queries_today": 7,
  "last_query_date": "2025-12-12"
});

// Check before query
if (queries_today >= 8) {
  // Use Exa instead
  await exa.search("Next.js 16 Server Actions");
} else {
  await context7.query("Next.js 16 Server Actions");
}
```

---

### Pattern 8: Docker Resource Management

**Situation:** Multiple Docker containers consuming resources

**Anti-Pattern:**
```
❌ All containers running 24/7
   - Serena: 512 MB RAM
   - Playwright: 2 GB RAM (browser)
   - GitHub: 256 MB RAM
   - Shadcn: 256 MB RAM

Total: 3 GB RAM always consumed
```

**Best Practice:**
```
✅ On-demand containers:
   - Serena: Always running (IDE integration)
   - Playwright: Start on test run, stop after
   - GitHub: Always running (small footprint)
   - Shadcn: Start on component add, stop after

Typical usage: 768 MB RAM (74% savings)
```

**Auto-stop Script:**
```bash
#!/bin/bash
# Stop unused MCP containers after 1 hour idle

docker stop mcp-playwright
docker stop mcp-shadcn

# Keep critical servers
# mcp-serena, mcp-github remain running
```

---

## Error Handling

### Pattern 9: Graceful Degradation

**Situation:** MCP server unavailable

**Anti-Pattern:**
```
❌ Hard failure:
   if (serena.unavailable) {
     throw new Error("Cannot analyze file");
   }
```

**Best Practice:**
```
✅ Fallback chain:
   1. Try Serena (optimal)
   2. Fall back to Read tool (acceptable)
   3. Manually review file (last resort)

Example:
try {
  const analysis = await serena.get_symbols_overview(file);
} catch (error) {
  console.warn("Serena unavailable, using Read");
  const content = await read(file);
  // Manual parsing or abbreviated analysis
}
```

**Fallback Matrix:**
| Primary | Fallback 1 | Fallback 2 |
|---------|-----------|------------|
| Serena | Read | Manual review |
| Context7 | Exa | WebSearch |
| Neon MCP | Direct SQL | Manual DB query |
| Playwright | Manual testing | Unit tests only |

---

### Pattern 10: Retry Logic

**Situation:** Transient failures (network, timeout)

**Anti-Pattern:**
```
❌ Single attempt:
   const result = await neon.query();
   // Fails on temporary network glitch
```

**Best Practice:**
```
✅ Exponential backoff:
   async function retryQuery(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await sleep(2 ** i * 1000); // 1s, 2s, 4s
       }
     }
   }

   const result = await retryQuery(() => neon.query());
```

**When to Retry:**
- ✅ Network timeouts
- ✅ Rate limit errors (with longer backoff)
- ✅ Database cold start (Neon)
- ❌ Authentication errors
- ❌ Invalid query syntax
- ❌ Resource not found

---

## Security Best Practices

### Pattern 11: Environment Variable Management

**Anti-Pattern:**
```
❌ Hardcode API keys:
   const NEON_API_KEY = "napi_xxxxx";
```

**Best Practice:**
```
✅ Use .env.local + validation:

// .env.local (gitignored)
NEON_API_KEY=napi_xxxxx
GITHUB_PAT=ghp_xxxxx
EXA_API_KEY=exa_xxxxx

// Validation at startup
if (!process.env.NEON_API_KEY?.startsWith("napi_")) {
  throw new Error("Invalid NEON_API_KEY format");
}
```

**Key Rotation:**
```bash
# Quarterly key rotation
1. Generate new key (Neon dashboard)
2. Update .env.local
3. Test MCP connection
4. Revoke old key
5. Update state.json with rotation date
```

---

### Pattern 12: Least Privilege Access

**Situation:** GitHub token permissions

**Anti-Pattern:**
```
❌ Full access token:
   Scopes: repo, admin:org, delete_repo, workflow
```

**Best Practice:**
```
✅ Minimal scopes:
   Required: repo (read/write), workflow (update actions)
   Optional: read:org (only if needed)
   Never: delete_repo, admin:org
```

**Database Access:**
```sql
-- Create read-only user for MCP queries
CREATE USER mcp_readonly WITH PASSWORD 'xxx';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_readonly;

-- Use in Neon MCP config
NEON_DATABASE_ROLE=mcp_readonly
```

---

## Workflow Integration

### Pattern 13: Feature Development Workflow

**Optimal Flow:**
```
1. Research (Exa/Context7)
   ├─ Find best practices
   └─ Check latest API docs

2. Analyze (Serena)
   ├─ Understand existing code
   └─ Identify integration points

3. Design (Memory)
   ├─ Store design decisions
   └─ Document trade-offs

4. Implement
   └─ Write code

5. Test (Playwright)
   ├─ Unit tests
   ├─ Integration tests
   └─ E2E smoke test

6. Review (GitHub)
   ├─ Create PR
   └─ Request review

7. Learn (Memory)
   └─ Store insights for next time
```

**Example: Add New Payment Method**
```
1. Exa: "Stripe vs T-Bank comparison for Russian market"
   → Decision: Stay with T-Bank

2. Context7: "T-Bank API latest changes 2025"
   → Check for breaking changes

3. Serena: analyze lib/tbank.ts
   → Understand current implementation

4. Memory: Store design decision
   → "Stick with T-Bank due to local market share"

5. Implement: Update lib/tbank.ts

6. Playwright: Test new payment flow
   → E2E test with mock T-Bank response

7. GitHub: Create PR "Add Apple Pay support via T-Bank"

8. Memory: Store implementation notes
   → "T-Bank Apple Pay requires iOS 14+"
```

---

### Pattern 14: Bug Fixing Workflow

**Optimal Flow:**
```
1. Reproduce (Playwright)
   └─ Automated test to reproduce bug

2. Debug (Serena + Neon)
   ├─ Analyze code path
   └─ Check database state

3. Research (Exa)
   └─ Search for known issues

4. Fix
   └─ Update code

5. Verify (Playwright)
   └─ Regression test

6. Document (Memory)
   └─ Store bug pattern + fix
```

**Example: Payment Not Updating Status**
```
1. Playwright: Reproduce
   test('payment success updates status', async () => {
     await pay();
     expect(await hasPayment()).toBe(true); // FAILS
   });

2. Serena: Analyze webhook
   find_symbol("webhookHandler", include_body=true)
   → See database update logic

3. Neon: Check database
   query_table("payments", {user_id: userId})
   → status is still 'pending'

4. Research: Exa "T-Bank webhook timing issues"
   → Find race condition in webhook processing

5. Fix: Add transaction + retry logic
   await db.transaction(async (tx) => {
     await tx.update(payments).set({status: 'succeeded'});
   });

6. Test: Verify fix
   test('payment success updates status', async () => {
     await pay();
     await waitFor(() => hasPayment() === true); // PASSES
   });

7. Memory: Store
   {
     "bug": "T-Bank webhook race condition",
     "cause": "Webhook arrives before payment status update",
     "fix": "Use transaction + 500ms retry with exponential backoff",
     "file": "app/api/payment/webhook/route.ts"
   }
```

---

## Testing Strategies

### Pattern 15: Test Pyramid with MCP

**Optimal Distribution:**
```
        E2E (Playwright)
       /                 \
      / 10% - Full flows  \
     /________________________\
    |   Integration (API)     |
    |   30% - API endpoints   |
    |__________________________|
   /                            \
  /   Unit (Jest)                \
 /   60% - Pure functions         \
/_________________________________\
```

**MCP Usage by Level:**
```
Unit Tests:
- No MCP needed (pure functions)
- Fast, run on every commit

Integration Tests:
- Neon MCP: Database queries
- Mock external APIs (T-Bank, Imagen)
- Medium speed, run on PR

E2E Tests:
- Playwright MCP: Full browser automation
- Real payment flow (test mode)
- Slow, run on deploy
```

**Example Test Suite:**
```javascript
// Unit: 60% coverage, 0 MCP calls
test('calculateTotal', () => {
  expect(calculateTotal([100, 200])).toBe(300);
});

// Integration: 30% coverage, Neon MCP
test('payment creates DB record', async () => {
  await POST('/api/payment/create', {deviceId: 'test'});
  const payment = await neon.query('payments', {device_id: 'test'});
  expect(payment.status).toBe('pending');
});

// E2E: 10% coverage, Playwright MCP
test('full payment flow', async () => {
  await page.goto('/');
  await page.click('[data-testid="pay-button"]');
  await page.waitForURL('**/callback');
  expect(await page.locator('.success').isVisible()).toBe(true);
});
```

---

### Pattern 16: Mock vs Real MCP

**When to Mock:**
```
✅ Unit tests (fast, isolated)
✅ CI/CD (no external dependencies)
✅ Offline development
```

**When to Use Real:**
```
✅ Integration tests (verify connections)
✅ E2E tests (realistic scenarios)
✅ Pre-production validation
```

**Mock Implementation:**
```javascript
// Mock Neon for unit tests
const mockNeon = {
  query: jest.fn().mockResolvedValue([
    {id: 1, device_id: 'test', telegram_user_id: 123456}
  ])
};

// Real Neon for E2E
const realNeon = new NeonMCP(process.env.NEON_API_KEY);
```

---

## Documentation Patterns

### Pattern 17: Self-Documenting MCP Usage

**Anti-Pattern:**
```
❌ Undocumented MCP calls:
   const data = await serena.find_symbol("foo");
   // What does this do? Why here?
```

**Best Practice:**
```
✅ Inline documentation:
   // Use Serena to analyze payment handler signature
   // without loading full implementation (token optimization)
   const signature = await serena.find_symbol(
     "handlePayment",
     {include_body: false}
   );
```

**MCP Call Comments:**
```javascript
// Pattern: Research → Analyze → Implement
// 1. Research: Check latest T-Bank API docs
const docs = await context7.query("T-Bank webhook signature");

// 2. Analyze: Understand current implementation
const current = await serena.get_symbols_overview("lib/tbank.ts");

// 3. Implement: Add SHA256 verification
// (implementation)
```

---

### Pattern 18: Learning Documentation

**After Every Session:**
```
1. What worked well? → Store in Memory
2. What could improve? → Store in Memory
3. New patterns discovered? → Add to this doc

Memory entry format:
{
  "session_date": "2025-12-12",
  "project": "PinGlass",
  "learnings": [
    {
      "insight": "Serena progressive drill-down saves 80% tokens",
      "pattern": "overview → signature → body",
      "confidence": 0.95
    }
  ]
}
```

**Quarterly Review:**
```bash
# Extract all learnings
memory.recall({"category": "efficiency", "confidence": ">0.9"})

# Update best practices doc
# Share with team
# Incorporate into workflow
```

---

## Performance Metrics

Track these KPIs to validate best practices:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Token efficiency | >60% savings | Serena vs Read |
| Query time | <3s avg | MCP operation latency |
| Cache hit rate | >70% | Memory recall vs new query |
| Parallel speedup | >40% | Concurrent vs sequential |
| Test coverage | >80% | With minimal E2E (10%) |
| Rate limit hits | <5% | Monthly quota usage |

---

## Anti-Patterns to Avoid

### ❌ Over-reliance on Single Server
```
Don't: Only use Serena for everything
Do: Use right tool (Serena for code, Read for small files)
```

### ❌ Ignoring Rate Limits
```
Don't: Query Context7 unlimited until blocked
Do: Track usage, fall back gracefully
```

### ❌ Synchronous MCP Calls
```
Don't: await serena(); await neon(); await exa(); (23s)
Do: Promise.all([serena(), neon(), exa()]); (10s)
```

### ❌ No Error Handling
```
Don't: const result = await mcp.call();
Do: try { result = await mcp.call(); } catch { fallback(); }
```

### ❌ Storing Sensitive Data in Memory
```
Don't: memory.store({api_key: "secret"});
Do: Use environment variables + .env.local
```

---

## Future Improvements

1. **Auto-optimization:** Detect slow patterns, suggest improvements
2. **Usage Analytics:** Track which servers save most time/tokens
3. **Smart Caching:** Auto-invalidate Context7 cache on dependency updates
4. **Parallel Testing:** Run Playwright tests in parallel containers
5. **Cost Alerting:** Notify when approaching rate limits

---

## Conclusion

These best practices are living documents. Update based on:
- New MCP server features
- Performance metrics from real usage
- Team feedback and pain points
- Quarterly retrospectives

**Next Review:** 2025-03-12 (quarterly)

---

**Version:** 1.0
**Last Updated:** 2025-12-12
**Maintained By:** PinGlass Development Team
