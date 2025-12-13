# MCP Servers - Quick Start Guide

**Last Updated:** 2025-12-12
**Configuration Version:** 2.0

---

## TL;DR

```bash
# Check health
docker ps --filter "name=mcp-"

# Restart if needed
docker restart mcp-serena mcp-playwright mcp-github mcp-shadcn

# Test npx servers
npx -y @neondatabase/mcp-server-neon --help
npx -y @modelcontextprotocol/server-memory --help
npx -y @upstash/context7-mcp@latest --help
```

---

## 8 MCP Servers

| Server | Priority | Use For |
|--------|----------|---------|
| **serena** | Critical | Code analysis (80% token savings) |
| **neon** | Critical | Database queries, schema management |
| **memory** | High | Store learnings across sessions |
| **context7** | High | Latest docs (Next.js 16, React 19) |
| **playwright** | High | E2E testing (payment, generation flows) |
| **github** | High | PRs, issues, git operations |
| **exa** | Medium | Web search for APIs, examples |
| **shadcn** | Medium | UI components (unhealthy status OK) |

---

## When to Use What

### Analyzing Code
- **File >100 lines:** Serena (progressive drill-down)
- **File <100 lines:** Read tool
- **JSON/MD/YAML:** Read tool

### Documentation Lookup
- **Modern frameworks:** Context7 (Next.js 16, React 19)
- **API examples:** Exa search
- **Project decisions:** Memory recall

### Testing
- **Full E2E flow:** Playwright
- **API endpoints:** Direct curl/Postman
- **Unit tests:** Jest (no MCP)

### Database
- **Quick queries:** Neon MCP
- **Complex SQL:** Direct lib/db.ts
- **Schema changes:** Neon MCP

---

## Common Workflows

### Debug Payment Issue
```
1. Neon: Check user.is_pro and payments.status
2. Serena: Analyze app/api/payment/webhook/route.ts
3. Playwright: Reproduce with E2E test
4. Memory: Store bug pattern
```

### Add New Feature
```
1. Context7: Check latest API docs
2. Serena: Analyze existing code structure
3. Exa: Find implementation examples
4. Implement → Test (Playwright) → PR (GitHub)
5. Memory: Store design decisions
```

### Code Review
```
1. Serena: Analyze changed files
2. GitHub: Create PR with description
3. Memory: Store review feedback patterns
```

---

## Quick Reference

### Serena Progressive Drill-Down
```
1. get_symbols_overview(file) → See structure
2. find_symbol(name, include_body=false) → Get signature
3. find_symbol(name, include_body=true) → Get implementation

Saves 80% tokens vs reading full file
```

### Parallel Operations
```
Run simultaneously:
- Serena analyze file
- Neon check database
- Exa search docs

Saves 57% time vs sequential
```

### Rate Limits
- Context7: 10/day (fallback to Exa)
- Exa: 1000/month
- Shadcn GitHub API: 60/hour

---

## Troubleshooting

### Serena not responding
```bash
docker restart mcp-serena
sleep 10  # Wait for reindexing
```

### Neon timeout
```bash
# Wake up project (cold start)
psql "$DATABASE_URL" -c "SELECT 1;"
sleep 15
```

### Playwright browser failed
```bash
docker restart mcp-playwright
docker exec -i mcp-playwright npx playwright install chromium
```

### Shadcn "unhealthy"
**This is OK** - server runs in SSE mode, health check doesn't apply

---

## Full Documentation

- **Usage Guide:** [MCP_SERVERS_GUIDE.md](MCP_SERVERS_GUIDE.md) (713 lines)
- **Troubleshooting:** [MCP_TROUBLESHOOTING.md](MCP_TROUBLESHOOTING.md) (758 lines)
- **Best Practices:** [MCP_BEST_PRACTICES.md](MCP_BEST_PRACTICES.md) (860 lines)
- **Optimization Summary:** [MCP_OPTIMIZATION_SUMMARY.md](MCP_OPTIMIZATION_SUMMARY.md) (412 lines)

---

## Health Check Script

Create `scripts/check-mcp-health.sh`:
```bash
#!/bin/bash
echo "=== MCP Health Check ==="
docker ps --filter "name=mcp-" --format "{{.Names}}: {{.Status}}"
echo ""
echo -n "Neon: "; npx -y @neondatabase/mcp-server-neon --version 2>&1 | head -1
echo -n "Memory: "; npx -y @modelcontextprotocol/server-memory --version 2>&1 | head -1
echo -n "Context7: "; npx -y @upstash/context7-mcp@latest --version 2>&1 | head -1
echo -n "Exa: "; npx -y exa-mcp-server --version 2>&1 | head -1
```

Run: `bash scripts/check-mcp-health.sh`

---

## Configuration

**File:** `.mcp.json` (v2.0)

All servers configured with:
- Description
- Usage notes
- Priority level
- Health status

---

## Support

- **Project Docs:** `CLAUDE.md`
- **Global Config:** `~/.claude/CLAUDE.md`
- **Memory State:** `~/.claude/memory/state.json`
- **Infrastructure Score:** 108/108 (Perfect)

---

**Quick Start Done!** Read full guides for deep dive into optimization patterns.
