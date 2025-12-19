# Fotoset Audit - Quick Start Implementation Checklist

**Date:** December 19, 2025
**Project:** Fotoset (PinGlass)
**Overall Score:** 8.2/10 - PRODUCTION READY

---

## READ FIRST (15 minutes)

- [ ] Read `AUDIT_SUMMARY.md` - Overview
- [ ] Read `AUDIT_SCORES.txt` - Visual scorecard
- [ ] Check `AUDIT_INDEX.md` - Complete guide

---

## CRITICAL FIXES (WEEK 1)

### Fix 1: Jest Configuration Broken
**Time:** 2 hours | **Effort:** Easy | **Impact:** CRITICAL

```bash
# In jest.config.unit.js, update transform section:
# See AUDIT_RECOMMENDATIONS.md section 1 for full code
```

- [ ] Update jest.config.unit.js with correct TypeScript handling
- [ ] Run: `npm test` - should now work
- [ ] Fix any test failures
- [ ] Commit: "fix: jest configuration and TypeScript parsing"

**OR (Recommended):** Migrate to Vitest
```bash
npm install -D vitest @vitest/ui
# Create vitest.config.ts (see AUDIT_RECOMMENDATIONS.md)
npm run test  # Should use Vitest
```

---

### Fix 2: Add Input Validation with Zod
**Time:** 4 hours | **Effort:** Easy | **Impact:** HIGH

```bash
npm install zod
```

- [ ] Create `lib/validation-schemas.ts` with Zod schemas
- [ ] Update API routes to use validation
- [ ] Start with: `app/api/avatars/route.ts`
- [ ] Test validation errors
- [ ] Commit: "feat: add input validation with Zod"

**Code template:** See AUDIT_RECOMMENDATIONS.md section 3

---

## HIGH PRIORITY (WEEK 2)

### Fix 3: Migrate Rate Limiting to Upstash
**Time:** 2 hours | **Effort:** Easy | **Impact:** HIGH

```bash
npm install @upstash/redis @upstash/ratelimit
```

Environment variables:
```env
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

- [ ] Install Upstash packages
- [ ] Set environment variables in Vercel
- [ ] Update `lib/rate-limiter.ts`
- [ ] Test rate limiting
- [ ] Commit: "fix: migrate rate limiting to Upstash Redis"

**Code template:** See AUDIT_RECOMMENDATIONS.md section 4

---

### Fix 4: Enable TypeScript Strict Mode (Phase 1)
**Time:** 3 hours | **Effort:** Medium | **Impact:** MEDIUM

- [ ] Update tsconfig.json:
  ```json
  {
    "compilerOptions": {
      "noImplicitAny": true,
      "noImplicitThis": true,
      "strict": false  // Still false for now
    }
  }
  ```
- [ ] Run: `npm run build` - check for type errors
- [ ] Fix high-priority type errors
- [ ] Commit: "feat: enable TypeScript Phase 1 checks"

**Full guide:** See AUDIT_RECOMMENDATIONS.md section 2

---

### Fix 5: Add Health Check Endpoint (Quick Win)
**Time:** 1 hour | **Effort:** Easy | **Impact:** MEDIUM

- [ ] Create `app/api/health/route.ts`
- [ ] Test endpoint: `curl http://localhost:3000/api/health`
- [ ] Should return database status
- [ ] Commit: "feat: add health check endpoint"

**Code template:** See AUDIT_RECOMMENDATIONS.md section 10.1

---

## MEDIUM PRIORITY (WEEK 3-4)

### Fix 6: Add E2E Tests with Playwright
**Time:** 10 hours | **Effort:** Medium | **Impact:** HIGH

```bash
# Playwright config already exists
npx playwright test --ui  # Start with UI
```

Test scenarios to cover:
- [ ] Authentication flow (Telegram)
- [ ] Upload reference images
- [ ] Select style
- [ ] Generate photos
- [ ] Payment flow (optional)

**Code templates:** See AUDIT_RECOMMENDATIONS.md section 5

---

### Fix 7: Add Transaction Support
**Time:** 4 hours | **Effort:** Medium | **Impact:** MEDIUM

- [ ] Create `lib/db-transactions.ts`
- [ ] Update critical operations to use transactions:
  - Avatar creation + reference images
  - Payment processing
  - Job status updates
- [ ] Test transaction rollback
- [ ] Commit: "feat: add database transaction support"

**Code template:** See AUDIT_RECOMMENDATIONS.md section 6

---

### Fix 8: Enhance Security - Telegram Webhooks
**Time:** 3 hours | **Effort:** Medium | **Impact:** MEDIUM

- [ ] Update `lib/telegram-auth.ts` with:
  - Timing-safe HMAC comparison
  - Timestamp validation
  - Replay attack prevention
- [ ] Test with various edge cases
- [ ] Commit: "security: enhance Telegram webhook validation"

**Code template:** See AUDIT_RECOMMENDATIONS.md section 8

---

### Fix 9: Add Monitoring & Analytics
**Time:** 4 hours | **Effort:** Easy | **Impact:** MEDIUM

- [ ] Create `lib/monitoring.ts`
- [ ] Create `app/api/analytics/route.ts`
- [ ] Wire up generation tracking
- [ ] Wire up payment tracking
- [ ] Verify in Sentry dashboard
- [ ] Commit: "feat: add monitoring and analytics"

**Code template:** See AUDIT_RECOMMENDATIONS.md section 9

---

## OPTIONAL (NEXT QUARTER)

### Optional: Migrate to Drizzle ORM
**Time:** 20 hours | **Effort:** Hard | **Impact:** LOW (maintainability)

- [ ] Install Drizzle: `npm install drizzle-orm @drizzle-orm/neon-http`
- [ ] Define schema in `lib/schema.ts`
- [ ] Generate migrations
- [ ] Migrate queries one module at a time
- [ ] Test thoroughly
- [ ] Commit: "refactor: migrate to Drizzle ORM"

**Full guide:** See AUDIT_RECOMMENDATIONS.md section 7

---

## VERIFICATION CHECKLIST

After all fixes, verify:

```bash
# Code quality
npm run lint                    # Should pass
npm run build                   # Should build successfully
npm test                        # All tests pass
npm run test:e2e               # E2E tests pass

# Type checking
npx tsc --noEmit               # Should have 0 errors

# Performance
npm run build                   # Check bundle size
# Should be <200KB gzipped

# Security
npm audit                       # Should have 0 vulnerabilities

# Deployment
npm run start                   # Should start successfully
curl http://localhost:3000/api/health  # Should return health
```

---

## WEEKLY PROGRESS TRACKING

### Week 1: Critical Fixes
- [ ] Jest fixed (or migrated to Vitest)
- [ ] Input validation added (Zod)
- [ ] Health check working
- [ ] Tests passing: `npm test`
- [ ] Build successful: `npm run build`

**Milestone:** Jest ✅ Validation ✅

### Week 2: High Priority
- [ ] Rate limiting on Upstash
- [ ] TypeScript strict Phase 1
- [ ] E2E tests (5+ scenarios)
- [ ] All tests passing
- [ ] Deployed to staging

**Milestone:** Rate Limiting ✅ E2E Tests ✅

### Week 3: Medium Priority
- [ ] Transaction support added
- [ ] Telegram security enhanced
- [ ] E2E tests (10+ scenarios)
- [ ] Monitoring working
- [ ] Tests: 80% coverage

**Milestone:** Transactions ✅ Monitoring ✅

### Week 4: Polish
- [ ] TypeScript strict Phase 2
- [ ] E2E tests (15+ scenarios)
- [ ] All improvements deployed
- [ ] Tech debt: 4/10 → 2/10
- [ ] Full test coverage: 90%

**Milestone:** Production Ready ✅

---

## GIT COMMIT MESSAGES

Use these for consistency:

```bash
# Critical fixes
git commit -m "fix: jest configuration and TypeScript parsing"
git commit -m "feat: add input validation with Zod schemas"
git commit -m "fix: migrate rate limiting to Upstash Redis"

# High priority
git commit -m "feat: enable TypeScript strict mode Phase 1"
git commit -m "feat: add health check endpoint"
git commit -m "test: add E2E tests with Playwright"

# Medium priority
git commit -m "feat: add database transaction support"
git commit -m "security: enhance Telegram webhook validation"
git commit -m "feat: add monitoring and analytics"

# Optional
git commit -m "refactor: migrate to Drizzle ORM"
```

---

## TESTING COMMANDS

Run these to verify progress:

```bash
# After fixing Jest
npm test

# After adding validation
npm test -- validation-schemas.test.ts

# After setting up E2E
npx playwright test

# Full suite
npm run lint && npm test && npx playwright test

# Type check
npx tsc --noEmit

# Build check
npm run build

# Production check
npm run start
```

---

## DEPLOYMENT CHECKLIST

Before deploying to production:

- [ ] All tests passing: `npm test`
- [ ] E2E tests passing: `npx playwright test`
- [ ] No type errors: `npx tsc --noEmit`
- [ ] Build successful: `npm run build`
- [ ] Lint clean: `npm run lint`
- [ ] Security audit: `npm audit` (0 vulnerabilities)
- [ ] Git clean: `git status`
- [ ] Environment variables set in Vercel
- [ ] Database migrations applied
- [ ] Sentry configured
- [ ] Analytics working
- [ ] Rate limiting tested
- [ ] Health endpoint working

---

## ISSUE TRACKING

Create issues with these labels:

```
[CRITICAL] Jest configuration broken
[HIGH] Add input validation with Zod
[HIGH] Migrate rate limiting to Upstash
[HIGH] Enable TypeScript strict mode
[MEDIUM] Add E2E tests
[MEDIUM] Add transaction support
[MEDIUM] Enhance webhook security
[MEDIUM] Add monitoring
[OPTIONAL] Migrate to Drizzle ORM
```

---

## TEAM ASSIGNMENT

### For 1 Developer
- Week 1: Jest + Validation (6h)
- Week 2: Rate limit + Strict TS + E2E (11h)
- Week 3: Transactions + Security + Monitoring (12h)
- Week 4: Polish (8h)
- **Total: 37 hours (2 weeks sprint)**

### For 2 Developers
- **Developer 1:** Backend (Jest, validation, rate limit, transactions)
- **Developer 2:** Testing (E2E, monitoring, security)
- **Total: 20 hours (1 week sprint)**

### For 3+ Developers
- **Dev 1:** Jest + Validation
- **Dev 2:** Rate limit + Transactions
- **Dev 3:** E2E tests + Monitoring
- **Lead:** Oversee + Merge + Deploy
- **Total: 12 hours (3 days)**

---

## SUCCESS CRITERIA

| Phase | Target | Status |
|-------|--------|--------|
| Week 1 | Jest ✅ Validation ✅ | 8 hours |
| Week 2 | Rate Limit ✅ E2E ✅ | 13 hours |
| Week 3 | Transactions ✅ Security ✅ | 12 hours |
| Week 4 | All fixes + Polish | 8 hours |
| **Final** | **8.2/10 → 9.0/10** | **42 hours** |

---

## QUICK REFERENCE

### Critical Issues
1. Jest broken → Fix: Update jest.config.unit.js
2. No validation → Fix: Add Zod schemas
3. Rate limit lost → Fix: Use Upstash Redis

### High Priority
4. Type safety → Fix: Enable strict mode
5. No E2E tests → Fix: Write Playwright tests
6. Rate limiting → Fix: Migrate to Redis

### Medium Priority
7. Race conditions → Fix: Add transactions
8. Webhook validation → Fix: Enhance HMAC
9. No monitoring → Fix: Add analytics API

### Optional
10. Raw SQL → Fix: Migrate to Drizzle ORM

---

## RESOURCES

- AUDIT_REPORT_2025-12-19.md - Detailed findings
- AUDIT_RECOMMENDATIONS.md - Implementation guides
- AUDIT_SUMMARY.md - Executive summary
- AUDIT_INDEX.md - Complete index
- .mcp.json - MCP Serena config
- .claude/CLAUDE.md - Project docs

---

## SUPPORT

For specific questions, refer to:
- Jest issues: AUDIT_RECOMMENDATIONS.md #1
- Validation: AUDIT_RECOMMENDATIONS.md #3
- Rate limiting: AUDIT_RECOMMENDATIONS.md #4
- TypeScript: AUDIT_RECOMMENDATIONS.md #2
- E2E testing: AUDIT_RECOMMENDATIONS.md #5
- Security: AUDIT_RECOMMENDATIONS.md #8
- Monitoring: AUDIT_RECOMMENDATIONS.md #9

---

**Start Date:** Today
**Target Completion:** 4 weeks
**Expected Score Improvement:** 8.2/10 → 9.0/10
**Team Size:** 1-3 developers
**Total Effort:** 42 hours

**Begin with:** AUDIT_SUMMARY.md → AUDIT_RECOMMENDATIONS.md → Start fixing!

Good luck! 🚀
