# MCP Servers Guide - PinGlass (Fotoset)

## Overview

This guide covers the 8 MCP servers configured for PinGlass, their optimal usage patterns, and troubleshooting procedures.

**Configuration File:** `.mcp.json` (v2.0, updated 2025-12-12)

---

## Server Inventory

| Server | Type | Priority | Health | Purpose |
|--------|------|----------|--------|---------|
| **serena** | Docker | Critical | Healthy | Code analysis (60-90% token savings) |
| **neon** | npx | Critical | Healthy | PostgreSQL database operations |
| **playwright** | Docker | High | Healthy | E2E testing, browser automation |
| **github** | Docker | High | Healthy | Git operations, PR/issue management |
| **memory** | npx | High | NEW | Cross-session context persistence |
| **context7** | npx | High | NEW | Up-to-date documentation lookup |
| **exa** | npx | Medium | Healthy | Intelligent web search |
| **shadcn** | Docker | Medium | Unhealthy* | React UI component library |

*Expected - SSE mode, no stdio health check available

---

## 1. Serena (Code Analysis)

### Purpose
Semantic code analysis using Language Server Protocol (LSP) integration. Provides 60-90% token savings vs Read tool for files >100 lines.

### When to Use
- **Primary:** Analyzing `components/persona-app.tsx` (1059 lines)
- Exploring `app/api/generate/route.ts` API logic
- Understanding `lib/prompts.ts` structure (23 prompts)
- Any file >100 lines

### Best Practices

**Pattern 1: Progressive Drill-Down (80% token savings)**
```
1. get_symbols_overview(file_path)
   → See all functions, classes, types at a glance

2. find_symbol(symbol_name, include_body=false)
   → Get function signatures without implementation

3. find_symbol(symbol_name, include_body=true)
   → Only when you need implementation details
```

**Example:**
```
Task 1: get_symbols_overview("components/persona-app.tsx")
Result: See all 12 view states, 8 handlers, 15 types

Task 2: find_symbol("handlePayment", include_body=false)
Result: (deviceId: string, avatarId?: string) => Promise<void>

Task 3: find_symbol("handlePayment", include_body=true)
Result: Full payment modal logic
```

### When NOT to Use
- Small files (<100 lines): Use Read tool instead
- JSON/MD/YAML config files: Use Read tool
- Binary files or images

### Troubleshooting

**Issue:** `Error: Project not found`
```bash
# Check if serena container is running
docker ps | grep mcp-serena

# Restart container
docker restart mcp-serena

# Verify workspace mount
docker exec -i mcp-serena ls -la /workspace
```

**Issue:** `Timeout on symbol search`
- File might not be indexed yet (wait 5-10s)
- Try get_symbols_overview first to trigger indexing

---

## 2. Neon (PostgreSQL Database)

### Purpose
Direct database operations for Neon serverless PostgreSQL without SQL queries.

### When to Use
- Inspect database schema (users, avatars, payments, generated_photos)
- Verify payment status in database
- Check generation job progress
- Debug payment status issues

### Best Practices

**Pattern 1: Schema Exploration**
```
1. list_tables() → See all tables
2. describe_table("payments") → See columns, indexes, constraints
3. query_table("payments", filters={status: "succeeded"}) → Check data
```

**Pattern 2: Payment Debugging**
```
1. query_table("users", filters={device_id: "abc123"})
   → Get user info

2. query_table("payments", filters={user_id: 42})
   → See all payments for user

3. Check webhook updates:
   - payments.status should be "succeeded" after T-Bank callback
```

### When NOT to Use
- Complex queries (write raw SQL via lib/db.ts instead)
- Bulk operations (migrations)
- Performance-critical queries

### Troubleshooting

**Issue:** `NEON_API_KEY not found`
```bash
# Check .env.local
grep NEON_API_KEY .env.local

# Verify key is valid
# Get from: https://console.neon.tech/app/settings/api-keys
```

**Issue:** `Connection timeout`
- Neon project might be asleep (cold start)
- Wait 10-15 seconds and retry
- Check Neon dashboard: https://console.neon.tech/

---

## 3. Playwright (E2E Testing)

### Purpose
Browser automation for testing payment flows, photo generation UI, and callback pages.

### When to Use
- Test payment flow end-to-end (upload → pay → redirect → callback)
- Verify T-Bank redirect and return flow
- Test file upload UI (drag-n-drop 10-20 photos)
- Validate generation progress UI

### Best Practices

**Pattern 1: Payment Flow Test**
```javascript
1. Navigate to app
2. Upload test photos
3. Click "Generate" → Payment modal appears
4. Click "Pay 500₽" → T-Bank redirect
5. Simulate payment success
6. Verify callback page → paid = true
7. Check dashboard access
```

**Pattern 2: Generation Test**
```javascript
1. Login as paid user (user with successful payment)
2. Create new persona
3. Upload 15 photos
4. Select "Professional" style
5. Click "Generate"
6. Wait for job completion (mock API)
7. Verify 23 photos appear in gallery
```

### When NOT to Use
- Unit tests (use Jest instead)
- API endpoint testing (use Postman/curl)
- Performance testing

### Troubleshooting

**Issue:** `Browser launch failed`
```bash
# Check Playwright container
docker ps | grep mcp-playwright

# Restart if needed
docker restart mcp-playwright

# Verify Playwright version
docker exec -i mcp-playwright npx playwright --version
```

**Issue:** `Element not found`
- Add longer wait times for async operations
- Use `waitForSelector` instead of immediate clicks
- Check if element is in Shadow DOM

---

## 4. GitHub (Git Operations)

### Purpose
Git operations, PR creation, issue tracking without leaving the IDE.

### When to Use
- Create pull requests after feature implementation
- Track issues related to bugs/features
- Check deployment status
- View commit history

### Best Practices

**Pattern 1: Feature Development Flow**
```bash
1. Create feature branch
2. Make code changes
3. Commit with message
4. Push to remote
5. Create PR with description
6. Request review
```

**Pattern 2: Bug Tracking**
```bash
1. Create issue with bug details
2. Link commits to issue
3. Reference issue in PR
4. Close issue on merge
```

### When NOT to Use
- Complex merge conflicts (use VS Code Source Control)
- Interactive rebase (not supported)
- GPG signing (configure locally)

### Troubleshooting

**Issue:** `GITHUB_PERSONAL_ACCESS_TOKEN not set`
```bash
# Set in environment
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_xxxxx"

# Or add to .env.local
echo "GITHUB_PAT=ghp_xxxxx" >> .env.local
```

**Issue:** `403 Forbidden`
- Token expired → regenerate in GitHub Settings
- Insufficient permissions → token needs `repo`, `workflow` scopes

---

## 5. Memory (Cross-Session Context)

### Purpose
Persist learnings, patterns, and project decisions across sessions.

### When to Use
- Store insights about payment flow quirks
- Remember T-Bank webhook signature verification details
- Track successful Imagen API prompts
- Note user feedback patterns

### Best Practices

**Pattern 1: Learning Storage**
```
After fixing bug:
1. Store root cause in memory
2. Tag with category (payment/generation/ui)
3. Add confidence level (0-1)
4. Link to related code file

Memory entry:
{
  "insight": "T-Bank webhook requires SHA256(token+password) verification",
  "category": "payment",
  "file": "app/api/payment/webhook/route.ts",
  "confidence": 1.0
}
```

**Pattern 2: Pattern Recognition**
```
After successful implementation:
1. Extract repeatable pattern
2. Store with usage example
3. Track success rate

Example:
{
  "pattern": "Device ID auth flow",
  "usage": "localStorage → API → DB check → payment status",
  "successRate": 0.98
}
```

### When NOT to Use
- Temporary session data (use in-memory state)
- Sensitive data (use encrypted storage)
- Large binary data

### Troubleshooting

**Issue:** `Memory server not responding`
```bash
# Test server
npx -y @modelcontextprotocol/server-memory

# Check if it's a fresh install issue
rm -rf node_modules/.cache
```

---

## 6. Context7 (Up-to-Date Documentation)

### Purpose
Query latest documentation for Next.js 16, React 19, Tailwind 4, and T-Bank API.

### When to Use
- Verify Next.js 16 App Router best practices
- Check React 19 new features (use(), Server Components)
- Look up Tailwind 4 OKLCH color syntax
- Find T-Bank API endpoint changes

### Best Practices

**Pattern 1: API Verification**
```
Before implementing new feature:
1. Query context7 for latest API docs
2. Check breaking changes vs current version
3. Update implementation accordingly

Example:
"Next.js 16 Server Actions best practices"
→ Get latest patterns for form handling
```

**Pattern 2: Migration Guidance**
```
When upgrading dependencies:
1. Query migration guides
2. Check deprecated features
3. Test incrementally

Example:
"React 19 migration from React 18"
→ See what changes are needed
```

### When NOT to Use
- Project-specific documentation (use Serena)
- Historical version docs (use WebSearch)
- Internal API docs (add to .serena/docs/)

### Troubleshooting

**Issue:** `Rate limit exceeded`
- Context7 uses Upstash under the hood
- Free tier: 10 requests/day
- Upgrade or use WebSearch as fallback

**Issue:** `Documentation not found`
- Try broader search terms
- Check if library is supported
- Use Exa as fallback

---

## 7. Exa (Web Search)

### Purpose
Intelligent web search optimized for code context and technical documentation.

### When to Use
- Search for T-Bank API implementation examples
- Find Google Imagen 3.0 best practices
- Look up YeScale proxy documentation
- Research payment webhook patterns

### Best Practices

**Pattern 1: Implementation Research**
```
Before implementing unfamiliar feature:
1. Search for official docs + examples
2. Look for GitHub repos with similar code
3. Find Stack Overflow discussions
4. Check for common pitfalls

Query: "T-Bank payment webhook SHA256 verification Node.js"
→ Find working examples
```

**Pattern 2: Debugging**
```
When stuck on error:
1. Search exact error message
2. Add context (Next.js 16, TypeScript)
3. Look for recent solutions (2024-2025)

Query: "Next.js 16 TypeError: fetch failed ECONNREFUSED"
→ Find recent bug reports
```

### When NOT to Use
- General knowledge (use WebSearch)
- Code search within project (use Serena)
- Real-time data (use Brave Search)

### Troubleshooting

**Issue:** `EXA_API_KEY not set`
```bash
# Get key from: https://exa.ai/
# Add to .env.local
echo "EXA_API_KEY=your_key" >> .env.local
```

**Issue:** `Search timeout`
- Simplify search query
- Remove special characters
- Try shorter terms

---

## 8. Shadcn (UI Components)

### Purpose
Add and update React shadcn/ui components (v4).

### When to Use
- Add new UI components (Dialog, Toast, Card)
- Update existing component styles
- Check component API changes

### Best Practices

**Pattern 1: Adding Component**
```
1. Search available components
2. Check component dependencies
3. Add component to project
4. Customize with Tailwind

Example: "Add Dialog component"
→ Installs with dependencies
→ Creates components/ui/dialog.tsx
```

**Pattern 2: Theming**
```
1. Use OKLCH color space (already configured)
2. Update CSS variables in globals.css
3. Components automatically inherit theme

Current theme:
--primary: oklch(0.68 0.19 274.73)
--secondary: oklch(0.85 0.02 274.73)
```

### When NOT to Use
- Non-shadcn components (build manually)
- Heavy customization (fork component)

### Troubleshooting

**Issue:** `Server unhealthy`
- **Expected behavior** - SSE mode doesn't support stdio health checks
- Server is functional despite "unhealthy" status
- Test: Try adding a component, if it works, ignore health status

**Issue:** `GitHub API rate limit (60 req/hr)`
```bash
# Add GITHUB_TOKEN to container
docker exec -i mcp-shadcn npm config set //registry.npmjs.org/:_authToken $GITHUB_TOKEN

# Or use npx version instead of Docker:
# Change in .mcp.json:
{
  "command": "cmd",
  "args": ["/c", "npx", "-y", "shadcn-mcp"]
}
```

**Issue:** `Component not found`
- Check if component exists in shadcn/ui v4
- Try alternative component name
- Search manually: https://ui.shadcn.com/

---

## Priority Matrix

### Critical (Use First)
1. **Serena** - Analyze persona-app.tsx, API routes, lib files
2. **Neon** - Check database state, verify payments, debug payment status

### High (Use Frequently)
3. **Memory** - Store learnings after each session
4. **Context7** - Verify API changes before implementation
5. **Playwright** - Test critical flows (payment, generation)
6. **GitHub** - Create PRs, track issues

### Medium (Use As Needed)
7. **Exa** - Research unfamiliar APIs, find examples
8. **Shadcn** - Add UI components (rate limited)

---

## Optimization Strategies

### 1. Token Efficiency
- Use **Serena** for files >100 lines → 60-90% savings
- Use **Read** for files <100 lines
- Use **Memory** to avoid re-explaining context

### 2. Time Efficiency
- Parallel MCP calls when independent
- Cache Context7/Exa results in Memory
- Use Serena's progressive drill-down (overview → signature → body)

### 3. Cost Efficiency
- Free tiers: Memory, Context7 (10/day), Exa (1000/month)
- Paid: None required for basic usage
- Monitor rate limits to avoid hitting quotas

---

## Health Check Commands

```bash
# Check all Docker containers
docker ps --format "table {{.Names}}\t{{.Status}}"

# Test Serena
docker exec -i mcp-serena /workspaces/serena/.venv/bin/serena --help

# Test Neon
npx -y @neondatabase/mcp-server-neon --help

# Test Playwright
docker exec -i mcp-playwright npx playwright --version

# Test GitHub
docker logs mcp-github --tail 20

# Test Shadcn (expected: unhealthy)
docker logs mcp-shadcn --tail 20

# Test Exa
npx -y exa-mcp-server --version

# Test Memory
npx -y @modelcontextprotocol/server-memory --help

# Test Context7
npx -y @upstash/context7-mcp@latest --help
```

---

## Restart Procedures

### Restart Single Server
```bash
# Docker servers
docker restart mcp-serena
docker restart mcp-playwright
docker restart mcp-github
docker restart mcp-shadcn

# npx servers (auto-restart on next call)
# No manual restart needed
```

### Restart All MCP Servers
```bash
# Stop all
docker stop mcp-serena mcp-playwright mcp-github mcp-shadcn

# Start all
docker start mcp-serena mcp-playwright mcp-github mcp-shadcn
```

### Full Reset
```bash
# Remove all MCP containers
docker rm -f mcp-serena mcp-playwright mcp-github mcp-shadcn

# Rebuild from docker-compose.yml (if exists)
docker-compose up -d

# Or recreate manually (see Docker setup docs)
```

---

## Common Issues & Solutions

### Issue: "MCP server not responding"
**Symptoms:** Timeout errors, no response

**Solutions:**
1. Check if container is running: `docker ps`
2. Check logs: `docker logs mcp-<name>`
3. Restart server: `docker restart mcp-<name>`
4. Verify network: `docker network inspect bridge`

### Issue: "Permission denied"
**Symptoms:** Cannot access files, database operations fail

**Solutions:**
1. Check .env.local permissions: `chmod 600 .env.local`
2. Verify API keys are set correctly
3. Check Docker volume mounts: `docker inspect mcp-serena`

### Issue: "Rate limit exceeded"
**Symptoms:** Shadcn GitHub API (60/hr), Context7 (10/day)

**Solutions:**
1. **Shadcn:** Add GITHUB_TOKEN or switch to npx mode
2. **Context7:** Use Exa/WebSearch as fallback
3. **Exa:** Upgrade plan or reduce search frequency

### Issue: "Stale cache"
**Symptoms:** Old data, outdated responses

**Solutions:**
1. Clear npx cache: `rm -rf ~/.npm/_npx`
2. Force reinstall: `npx -y --force <package>`
3. Restart Docker containers

---

## Integration with Workflows

### Workflow 1: New Feature Development
```
1. Research (Exa/Context7) → Find best practices
2. Design (Serena) → Analyze existing code
3. Implement → Write code
4. Test (Playwright) → E2E validation
5. Commit (GitHub) → Create PR
6. Learn (Memory) → Store insights
```

### Workflow 2: Bug Fixing
```
1. Reproduce → Playwright test
2. Debug (Serena) → Find root cause
3. Verify (Neon) → Check database state
4. Fix → Update code
5. Test → Playwright regression test
6. Document (Memory) → Store bug pattern
```

### Workflow 3: Payment Debugging
```
1. Check payment status (Neon) → payments.status
2. Verify user record (Neon) → users
3. Review webhook logs (Serena) → app/api/payment/webhook/route.ts
4. Test flow (Playwright) → End-to-end payment
5. Research (Exa) → T-Bank API docs
6. Document (Memory) → Store payment quirks
```

---

## Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Serena token savings | >60% | Compare with Read tool |
| Playwright test time | <5min | Full payment flow |
| Context7 response time | <3s | Documentation lookup |
| Neon query time | <500ms | Simple table query |
| Memory write time | <200ms | Store single entry |

---

## Future Improvements

1. **Add MCP Server:** `ref` (Anthropic docs lookup)
2. **Docker Compose:** Unified container management
3. **Health Dashboard:** Monitor all servers in one place
4. **Auto-restart:** Systemd/PM2 for container resilience
5. **Metrics Exporter:** Track usage, latency, errors

---

## Additional Resources

- **Serena Docs:** https://github.com/oraios/serena
- **Neon MCP:** https://github.com/neondatabase/mcp-server-neon
- **Playwright MCP:** https://github.com/microsoft/playwright-mcp
- **MCP Specification:** https://spec.modelcontextprotocol.io/
- **Context7 Docs:** https://github.com/upstash/context7-mcp

---

**Version:** 2.0
**Last Updated:** 2025-12-12
**Maintained By:** PinGlass Development Team
