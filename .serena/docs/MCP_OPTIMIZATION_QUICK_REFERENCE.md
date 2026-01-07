# MCP Optimization Quick Reference - PinGlass

**Last Updated:** 2025-12-13
**Version:** 1.0

This is a quick reference guide distilled from the comprehensive MCP Usage Optimization Guide.

---

## Quick Decision Matrix

### "Which MCP server should I use?"

| If you need to... | Use this MCP | Tool | Time |
|------------------|--------------|------|------|
| Understand large file (>100 lines) | Serena | `get_symbols_overview` | 2s |
| Find specific function | Serena | `find_symbol` | 1s |
| Edit function body | Serena | `replace_symbol_body` | 2s |
| Check payment status | Neon | `query_table` | 1s |
| Update payment status | Neon | `update_record` | 1s |
| Look up Next.js 16 docs | Context7 → Memory | `get-library-docs` | 3s → 0.5s cached |
| Search for error solution | Exa | `search` | 5s |
| Test payment flow E2E | Playwright | `browser_*` | 20s |
| Create PR | GitHub | `create_pull_request` | 5s |
| Save discovery | Memory | `store_memory` | 1s |
| Recall previous solution | Memory | `recall_memory` | 0.5s |

---

## Top 5 Optimization Patterns

### 1. Serena Progressive Drill-Down (92.5% token savings)
```
Step 1: get_symbols_overview() → Structure (500 tokens)
Step 2: find_symbol(include_body=false) → Signature (50 tokens)
Step 3: find_symbol(include_body=true) → Implementation (200 tokens)
Total: 750 tokens vs 10,000 tokens (Read entire file)
```

### 2. Memory Caching (97% token savings)
```
First time: Explain concept (500 tokens) + Store in Memory
Next times: Recall from Memory (50 tokens)
Example: T-Bank webhook signature calculation
```

### 3. Context7 + Memory Combo (94% time savings)
```
First query: Context7 "Next.js 16 Server Actions" (3s) → Cache in Memory
Subsequent: Memory recall (0.5s)
Valid for 30 days or until version changes
```

### 4. Parallel Operations (57% time savings)
```
Sequential: Task1 (10s) + Task2 (5s) + Task3 (8s) = 23s
Parallel: max(10s, 5s, 8s) = 10s
Use Promise.all() for independent read operations
```

### 5. Playwright + Neon Integration (80% manual testing reduction)
```
Playwright: Test UI flow
Neon: Verify database state changed correctly
Example: Payment flow → Check payment status updated
```

---

## Underutilized Servers (Priority Fixes)

### 1. Memory (40% → 80% target)
**Problem:** Not storing discoveries between sessions
**Fix:** Store after every bug fix, payment discovery, Imagen success
**Impact:** 97% token savings on repeated explanations

### 2. Context7 (30% → 60% target)
**Problem:** Not checking docs before implementing
**Fix:** Query before new features, batch related questions
**Impact:** 94% time savings with Memory caching

### 3. Playwright (20% → 50% target)
**Problem:** No automated E2E tests
**Fix:** Create tests/e2e/ with critical path tests
**Impact:** 80% reduction in manual testing

---

## Common Workflows (Copy-Paste Ready)

### Workflow 1: Analyze File for PR
```typescript
const [overview, commits] = await Promise.all([
  serena.get_symbols_overview("lib/tbank.ts"),
  github.list_commits("main", {limit: 10})
])
// Use for PR description
```

### Workflow 2: Debug Payment Issue
```typescript
const [code, payments, context] = await Promise.all([
  serena.find_symbol("webhookHandler", {include_body: true}),
  neon.query_table("payments", {status: "pending", limit: 10}),
  memory.recall({topic: "T-Bank webhook"})
])
// All context in 2s vs 6s sequential
```

### Workflow 3: Check Docs + Cache
```typescript
// Check cache first
let docs = await memory.recall({topic: "Next.js 16 Server Actions"})

if (!docs) {
  // Cache miss - query Context7
  docs = await context7.query("Next.js 16 Server Actions best practices 2025")
  await memory.store({topic: "Next.js 16 Server Actions", content: docs})
}
// 3s first time, 0.5s subsequent
```

### Workflow 4: E2E Test with DB Verification
```typescript
test('payment updates status', async ({ page }) => {
  const deviceId = `test-${Date.now()}`

  // Setup
  await neon.query(`INSERT INTO users (device_id) VALUES ($1)`, [deviceId])

  // UI flow
  await page.goto('/')
  await page.click('[data-testid="pay-button"]')

  // Verify DB - check payments table for status
  const payment = await neon.query_table("payments", {user_id: userId})
  expect(payment.status).toBe('succeeded') // MUST be succeeded after payment
})
```

---

## Rate Limits (Don't Exceed!)

| Server | Limit | Current Usage | Fallback |
|--------|-------|---------------|----------|
| Context7 | 10/day | 3/day (30%) | Exa → WebSearch |
| Exa | 1000/month | 50/month (5%) | WebSearch → Manual |
| Shadcn | 60/hour | 5/hour (8%) | Manual component copy |

**Monitoring:**
```javascript
// Track daily in Memory
await memory.store({
  topic: "mcp_rate_limits",
  date: "2025-12-13",
  context7: 3,  // Warning at 8
  exa: 50       // Warning at 800
})
```

---

## When NOT to Use MCP

| Scenario | Don't Use | Use Instead | Reason |
|----------|-----------|-------------|--------|
| Small file (<100 lines) | Serena | Read tool | Faster, simpler |
| JSON/YAML files | Serena | Read tool | No parsing needed |
| Simple git commands | GitHub MCP | Bash (git status) | Overhead |
| Local file search | - | Glob tool | Built-in |
| Environment variables | Memory | .env.local | Security |

---

## Emergency Troubleshooting

### MCP Server Down?
```bash
# Check Docker containers
docker ps --filter "name=mcp-"

# Restart if needed
docker restart mcp-serena mcp-playwright mcp-github mcp-shadcn

# Check npx servers (auto-start on use)
# Context7, Exa, Neon, Memory
```

### Rate Limit Hit?
```javascript
// Context7 quota exhausted → Use Exa
const docs = await exa.search("Next.js 16 Server Actions official docs")

// Exa quota exhausted → Use WebSearch
const docs = await webSearch("Next.js 16 Server Actions")
```

### Slow Performance?
```javascript
// Check for sequential operations (BAD)
const a = await serena.get_symbols_overview("file1.ts")  // 2s
const b = await neon.query_table("users")                // 1s
// Total: 3s

// Convert to parallel (GOOD)
const [a, b] = await Promise.all([
  serena.get_symbols_overview("file1.ts"),  // 2s
  neon.query_table("users")                  // 1s
])
// Total: 2s (33% faster)
```

---

## Success Metrics (Track These)

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Token efficiency | 60-90% | 80%+ | Serena vs Read comparison |
| Memory usage | 40% | 80% | Sessions with memory.store() |
| Context7 cache hit | 50% | 80% | Memory recalls vs queries |
| E2E test coverage | 0% | 50% | Critical paths automated |
| Parallel operations | 30% | 70% | Promise.all() usage |

---

## Quick Wins (Implement Today)

### 1. Add Memory Storage (5 minutes)
After every significant discovery:
```javascript
await memory.store({
  topic: "discovery-name",
  insight: "what-you-learned",
  code: "file:line-number",
  date: new Date().toISOString()
})
```

### 2. Parallelize Independent Calls (5 minutes)
Find sequential MCP calls and convert:
```javascript
// Before
const a = await call1()
const b = await call2()

// After
const [a, b] = await Promise.all([call1(), call2()])
```

### 3. Cache Context7 Queries (5 minutes)
Before querying Context7:
```javascript
const cached = await memory.recall({topic: "framework-topic"})
if (!cached) {
  const fresh = await context7.query("...")
  await memory.store({topic: "framework-topic", content: fresh})
}
```

---

## Project-Specific Patterns

### PinGlass (Fotoset) Common Tasks

#### Task: Debug Payment Webhook
```typescript
// 1. Analyze webhook code
const webhook = await serena.find_symbol("webhookHandler", {include_body: true})

// 2. Check recent payments
const payments = await neon.query_table("payments", {
  order_by: "created_at DESC",
  limit: 5
})

// 3. Recall known issues
const context = await memory.recall({topic: "T-Bank webhook"})

// Now debug with full context
```

#### Task: Verify Imagen Prompt Works
```typescript
// 1. Test prompt
const result = await imagen.generate(prompt, references)

// 2. If successful, store for reuse
if (result.success) {
  await memory.store({
    topic: "successful-imagen-prompts",
    category: style,  // professional, lifestyle, creative
    prompt: prompt,
    quality_score: 0.95
  })
}
```

#### Task: Create Feature PR
```typescript
// 1. Analyze all changed files (parallel)
const analyses = await Promise.all(
  changedFiles.map(f => serena.get_symbols_overview(f))
)

// 2. Get commit history
const commits = await github.list_commits("main", {limit: 10})

// 3. Create comprehensive PR
await github.create_pull_request({
  title: "feat: description",
  body: generateDescription(analyses, commits)
})

// 4. Store design decision
await memory.store({
  topic: "feature-name-design",
  decision: "rationale",
  pr_url: prUrl
})
```

---

## Key Learnings (Store in Memory)

These should be stored for cross-session learning:

### Payment System
- T-Bank webhook signature requires sorted keys + Password field
- Webhook can arrive before payment status update (race condition)
- Test mode uses real API with test card numbers

### AI Generation
- Imagen 3.0 requires reference images for consistency
- 23 prompts organized by style (Professional, Lifestyle, Creative)
- Fallback logic needed (some prompts may fail)

### Database
- Neon uses serverless PostgreSQL (cold starts possible)
- Parameterized queries prevent SQL injection
- Transactions needed for payment status updates (race conditions)

### Testing
- E2E tests should mock external APIs (T-Bank, Imagen)
- Database cleanup critical in afterEach()
- Test fixtures in tests/fixtures/

---

**Remember:** This is a living document. Update as you discover new patterns!

**Full Documentation:** See `MCP_USAGE_OPTIMIZATION_GUIDE.md` for comprehensive details.
