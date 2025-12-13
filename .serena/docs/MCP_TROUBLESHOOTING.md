# MCP Servers Troubleshooting Guide - PinGlass

## Quick Diagnostics

### Run Full Health Check
```bash
# Windows Git Bash / WSL
cd /c/Users/bob/Projects/Fotoset

# Check all Docker MCP containers
docker ps --filter "name=mcp-" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

# Check Docker container logs (last 30 lines each)
for container in mcp-serena mcp-playwright mcp-github mcp-shadcn; do
  echo "=== $container ==="
  docker logs $container --tail 30
  echo ""
done

# Test npx servers
echo "Testing Neon..."
npx -y @neondatabase/mcp-server-neon --version 2>&1 | head -5

echo "Testing Exa..."
npx -y exa-mcp-server --version 2>&1 | head -5

echo "Testing Memory..."
npx -y @modelcontextprotocol/server-memory --version 2>&1 | head -5

echo "Testing Context7..."
npx -y @upstash/context7-mcp@latest --version 2>&1 | head -5
```

---

## Problem 1: Serena Container Issues

### Symptom: "Project not found" or timeout errors

**Root Cause:** Docker workspace mount misconfigured or Serena index not built

**Diagnosis:**
```bash
# Check if container is running
docker ps | grep mcp-serena

# Check workspace mount
docker inspect mcp-serena --format '{{json .Mounts}}' | jq

# Verify serena binary exists
docker exec -i mcp-serena which serena

# Check project indexing status
docker exec -i mcp-serena ls -la /workspace
```

**Solution 1: Restart Container**
```bash
docker restart mcp-serena

# Wait 10 seconds for reindexing
sleep 10

# Test
docker exec -i mcp-serena /workspaces/serena/.venv/bin/serena --help
```

**Solution 2: Rebuild Container**
```bash
# Stop and remove
docker stop mcp-serena
docker rm mcp-serena

# Recreate with correct mount
# (See docker-compose.yml or manual docker run command)

# Example:
docker run -d \
  --name mcp-serena \
  -v "/c/Users/bob/Projects/Fotoset:/workspace" \
  ghcr.io/oraios/serena:latest
```

**Solution 3: Switch to uvx Mode**
If Docker continues failing, use uvx instead:

```json
// In .mcp.json
{
  "serena": {
    "command": "uvx",
    "args": [
      "--from",
      "git+https://github.com/oraios/serena",
      "serena",
      "start-mcp-server",
      "--project",
      "C:\\Users\\bob\\Projects\\Fotoset"
    ]
  }
}
```

### Symptom: "No symbols found" for existing file

**Root Cause:** File not indexed yet or indexing failed

**Solution:**
```bash
# Force reindex by restarting
docker restart mcp-serena

# Wait for indexing (30-60 seconds for large projects)
sleep 60

# Test with get_symbols_overview first
# This triggers indexing if not done
```

---

## Problem 2: Neon Server Issues

### Symptom: "NEON_API_KEY not found"

**Root Cause:** Environment variable not loaded from .env.local

**Diagnosis:**
```bash
# Check if key exists
grep NEON_API_KEY .env.local

# Verify key format (should start with "napi_")
echo $NEON_API_KEY
```

**Solution:**
```bash
# Regenerate key if needed
# Go to: https://console.neon.tech/app/settings/api-keys

# Update .env.local
echo "NEON_API_KEY=napi_xxxxx" >> .env.local

# Reload environment
source .env.local

# Test connection
npx -y @neondatabase/mcp-server-neon
```

### Symptom: "Connection timeout" or "Project not found"

**Root Cause:** Neon project asleep (cold start) or network issue

**Solution 1: Wake Up Project**
```bash
# Connect via psql to wake up
psql "$DATABASE_URL" -c "SELECT 1;"

# Wait 10-15 seconds for warmup
sleep 15

# Retry MCP operation
```

**Solution 2: Check Project Status**
1. Go to https://console.neon.tech/
2. Find project "cool-grass-27858957"
3. Check if suspended or deleted
4. Resume if needed

**Solution 3: Verify Connection String**
```bash
# Test DATABASE_URL
psql "$DATABASE_URL" -c "SELECT current_database();"

# Should return: neondb
```

---

## Problem 3: Playwright Container Issues

### Symptom: "Browser launch failed"

**Root Cause:** Chromium binary missing or container out of memory

**Diagnosis:**
```bash
# Check container status
docker ps | grep mcp-playwright

# Check logs for errors
docker logs mcp-playwright --tail 50

# Verify Playwright version
docker exec -i mcp-playwright npx playwright --version
```

**Solution 1: Restart Container**
```bash
docker restart mcp-playwright

# Wait for browser download (first run only)
sleep 30

# Test
docker exec -i mcp-playwright npx playwright --version
```

**Solution 2: Reinstall Browsers**
```bash
docker exec -i mcp-playwright npx playwright install chromium

# Or full install
docker exec -i mcp-playwright npx playwright install --with-deps
```

**Solution 3: Increase Memory**
```bash
# Check Docker memory allocation
docker stats mcp-playwright --no-stream

# Increase if <2GB:
# Docker Desktop → Settings → Resources → Memory → 4GB minimum
```

### Symptom: "Element not found" in tests

**Root Cause:** Timing issue or selector changed

**Solution:**
```javascript
// Add explicit waits
await page.waitForSelector('[data-testid="payment-modal"]', {
  timeout: 10000
});

// Use more specific selectors
await page.locator('button:has-text("Pay 500₽")').click();

// Wait for network idle
await page.waitForLoadState('networkidle');
```

---

## Problem 4: GitHub Container Issues

### Symptom: "GITHUB_PERSONAL_ACCESS_TOKEN not set"

**Root Cause:** Environment variable not passed to Docker container

**Diagnosis:**
```bash
# Check if token exists locally
echo $GITHUB_PERSONAL_ACCESS_TOKEN

# Check .env.local
grep GITHUB_PAT .env.local

# Verify token is passed to container
docker inspect mcp-github --format '{{json .Config.Env}}' | jq
```

**Solution:**
```bash
# Export token
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_xxxxx"

# Or add to .env.local
echo "GITHUB_PAT=ghp_xxxxx" >> .env.local

# Recreate container with env
docker stop mcp-github
docker rm mcp-github

docker run -d \
  --name mcp-github \
  -e GITHUB_PERSONAL_ACCESS_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN" \
  mcp-github-mcp
```

### Symptom: "403 Forbidden" on operations

**Root Cause:** Token expired or insufficient permissions

**Solution:**
1. Regenerate token: https://github.com/settings/tokens
2. Required scopes:
   - `repo` (full control of private repos)
   - `workflow` (update GitHub Actions)
   - `read:org` (read org data)
3. Update token in .env.local
4. Restart container

---

## Problem 5: Shadcn "Unhealthy" Status

### Symptom: Docker health check shows "unhealthy"

**Root Cause:** Server runs in SSE mode, no stdio health check available

**This is EXPECTED behavior - server is functional**

**Diagnosis:**
```bash
# Check if server is actually responding
docker logs mcp-shadcn --tail 30

# Should see:
# INFO: SSE server listening on 0.0.0.0:7423
# INFO: Server started successfully - Mode: sse
```

**Solution:**
**No action needed** - server works despite health check failure

**If you still want to fix health check:**
```bash
# Switch to stdio mode
docker exec -i mcp-shadcn npm start -- --mode stdio

# Or use npx instead of Docker
# Change in .mcp.json:
{
  "shadcn": {
    "command": "cmd",
    "args": ["/c", "npx", "-y", "shadcn-mcp"]
  }
}
```

### Symptom: "GitHub API rate limit (60 req/hr)"

**Root Cause:** No GitHub token for component downloads

**Solution:**
```bash
# Add GITHUB_TOKEN to container
docker exec -i mcp-shadcn sh -c "export GITHUB_TOKEN=ghp_xxxxx"

# Or rebuild with token
docker run -d \
  --name mcp-shadcn \
  -e GITHUB_TOKEN="ghp_xxxxx" \
  shadcn-ui-mcp-server-shadcn-mcp-server
```

---

## Problem 6: Exa Search Issues

### Symptom: "EXA_API_KEY not set"

**Root Cause:** Missing API key

**Solution:**
```bash
# Get key from: https://exa.ai/
# Free tier: 1000 searches/month

# Add to .env.local
echo "EXA_API_KEY=your_key_here" >> .env.local

# Test
npx -y exa-mcp-server --version
```

### Symptom: "Search timeout" or no results

**Root Cause:** Query too complex or API rate limit

**Solution:**
```bash
# Simplify query (remove special chars)
BAD: "T-Bank API (SHA256) webhook verification in Node.js"
GOOD: "T-Bank webhook SHA256 Node.js"

# Add timeout handling
# Use WebSearch as fallback if Exa fails
```

---

## Problem 7: Memory Server Issues

### Symptom: "Server not responding"

**Root Cause:** First-time install or cache corruption

**Diagnosis:**
```bash
# Test server
npx -y @modelcontextprotocol/server-memory --help

# Check version
npm view @modelcontextprotocol/server-memory version
```

**Solution:**
```bash
# Clear npx cache
rm -rf ~/.npm/_npx

# Force reinstall
npx -y --force @modelcontextprotocol/server-memory

# Test again
npx -y @modelcontextprotocol/server-memory --help
```

### Symptom: "Cannot write to memory"

**Root Cause:** Permissions or storage limit

**Solution:**
```bash
# Check storage location
# Default: ~/.local/share/mcp-memory/

# Check permissions
ls -la ~/.local/share/mcp-memory/

# Fix permissions if needed
chmod -R 755 ~/.local/share/mcp-memory/

# Check disk space
df -h ~
```

---

## Problem 8: Context7 Rate Limits

### Symptom: "Rate limit exceeded"

**Root Cause:** Free tier limit (10 requests/day)

**Solution 1: Use Cache**
```bash
# Context7 caches results for 24h
# Wait until tomorrow for same query

# Or use fallback
# 1. Exa search
# 2. WebSearch
# 3. Manual docs lookup
```

**Solution 2: Upgrade Plan**
```bash
# Go to: https://upstash.com/
# Upgrade to paid tier for higher limits
```

**Solution 3: Optimize Queries**
```bash
# Batch questions instead of multiple queries
BAD: 3 separate queries for Next.js, React, Tailwind
GOOD: 1 query "Next.js 16 + React 19 + Tailwind 4 best practices"
```

---

## Problem 9: Network Issues

### Symptom: "Cannot connect to MCP server"

**Root Cause:** Docker network misconfigured or firewall

**Diagnosis:**
```bash
# Check Docker network
docker network ls

# Inspect bridge network
docker network inspect bridge | jq '.[0].Containers'

# Check if containers can communicate
docker exec -i mcp-github ping -c 3 mcp-serena
```

**Solution:**
```bash
# Recreate Docker network
docker network create mcp-network

# Connect all containers
for container in mcp-serena mcp-playwright mcp-github mcp-shadcn; do
  docker network connect mcp-network $container
done

# Restart containers
docker restart mcp-serena mcp-playwright mcp-github mcp-shadcn
```

### Symptom: "npx server timeout"

**Root Cause:** npm registry slow or offline

**Solution:**
```bash
# Check npm registry
curl https://registry.npmjs.org/

# Use cache server
npm config set registry https://registry.npmmirror.com/

# Or use local cache
npm config set cache ~/.npm-cache --global
```

---

## Problem 10: Windows-Specific Issues

### Symptom: Path resolution errors

**Root Cause:** Windows path format (C:\) vs Unix (/c/)

**Solution:**
```bash
# Use Git Bash format in .mcp.json
BAD: "C:\\Users\\bob\\Projects\\Fotoset"
GOOD: "/c/Users/bob/Projects/Fotoset"

# Or use forward slashes
OK: "C:/Users/bob/Projects/Fotoset"
```

### Symptom: "Permission denied" on .env.local

**Root Cause:** Windows file permissions

**Solution:**
```bash
# In Git Bash
chmod 600 .env.local

# In PowerShell
icacls .env.local /inheritance:r /grant:r "$env:USERNAME:(R)"
```

### Symptom: Docker Desktop not running

**Solution:**
```bash
# Start Docker Desktop
# Open "Docker Desktop" from Start Menu

# Wait for startup (30-60 seconds)

# Verify
docker ps

# If still fails, restart Docker service
net stop com.docker.service
net start com.docker.service
```

---

## Emergency Recovery

### Complete MCP Reset

**When:** Nothing works, need fresh start

**Steps:**
```bash
# 1. Stop all containers
docker stop $(docker ps -q --filter "name=mcp-")

# 2. Remove all containers
docker rm $(docker ps -a -q --filter "name=mcp-")

# 3. Clear npx cache
rm -rf ~/.npm/_npx

# 4. Clear npm cache
npm cache clean --force

# 5. Restart Docker Desktop
# GUI: Right-click system tray → Quit Docker Desktop → Restart

# 6. Recreate containers
# (Use docker-compose.yml or manual docker run commands)

# 7. Test each server
docker ps --filter "name=mcp-"
npx -y @neondatabase/mcp-server-neon --version
npx -y exa-mcp-server --version
npx -y @modelcontextprotocol/server-memory --version
```

### Rollback to Previous Config

**When:** New config broke existing setup

**Steps:**
```bash
# 1. Restore old .mcp.json
git checkout HEAD~1 .mcp.json

# 2. Restart IDE (VS Code / Claude Desktop)

# 3. Verify servers load
# Check MCP panel in IDE

# 4. Test basic operations
# Serena: get_symbols_overview
# Neon: list_tables
# Playwright: launch browser
```

---

## Monitoring & Logging

### Enable Debug Logging

**For Docker containers:**
```bash
# Check logs with timestamps
docker logs mcp-serena -f --timestamps

# Save logs to file
docker logs mcp-serena > serena.log 2>&1

# Follow logs in real-time
docker logs -f mcp-serena
```

**For npx servers:**
```bash
# Run with debug flag
DEBUG=* npx -y @neondatabase/mcp-server-neon

# Save output
npx -y @neondatabase/mcp-server-neon 2>&1 | tee neon.log
```

### Create Health Check Script

Save as `scripts/check-mcp-health.sh`:
```bash
#!/bin/bash

echo "=== MCP Health Check ==="
echo "Date: $(date)"
echo ""

# Docker servers
echo "Docker Containers:"
docker ps --filter "name=mcp-" --format "{{.Names}}: {{.Status}}"
echo ""

# npx servers
echo "npx Servers:"
echo -n "Neon: "
npx -y @neondatabase/mcp-server-neon --version 2>&1 | head -1

echo -n "Exa: "
npx -y exa-mcp-server --version 2>&1 | head -1

echo -n "Memory: "
npx -y @modelcontextprotocol/server-memory --version 2>&1 | head -1

echo -n "Context7: "
npx -y @upstash/context7-mcp@latest --version 2>&1 | head -1

echo ""
echo "=== Health Check Complete ==="
```

Run: `bash scripts/check-mcp-health.sh`

---

## Performance Optimization

### Reduce Serena Indexing Time
```bash
# Add .sereneignore file
echo "node_modules/" > .sereneignore
echo ".next/" >> .sereneignore
echo "dist/" >> .sereneignore
echo "build/" >> .sereneignore

# Restart to apply
docker restart mcp-serena
```

### Speed Up npx Server Starts
```bash
# Use global install instead of npx
npm install -g @neondatabase/mcp-server-neon
npm install -g exa-mcp-server
npm install -g @modelcontextprotocol/server-memory

# Update .mcp.json to use global binaries
{
  "neon": {
    "command": "mcp-server-neon"
  }
}
```

### Cache Docker Images
```bash
# Pull all images at once
docker pull ghcr.io/oraios/serena:latest
docker pull mcr.microsoft.com/playwright:v1.48.0-jammy
docker pull mcp-github-mcp:latest
docker pull shadcn-ui-mcp-server-shadcn-mcp-server:latest

# Tag for faster reference
docker tag ghcr.io/oraios/serena:latest mcp-serena:latest
```

---

## Contact & Support

### Internal Resources
- **MCP Config:** `.mcp.json`
- **Usage Guide:** `.serena/docs/MCP_SERVERS_GUIDE.md`
- **Project Docs:** `CLAUDE.md`

### External Resources
- **Serena:** https://github.com/oraios/serena/issues
- **Neon:** https://neon.tech/docs/
- **Playwright:** https://playwright.dev/
- **MCP Spec:** https://spec.modelcontextprotocol.io/

### Common Commands Quick Reference
```bash
# Restart all
docker restart mcp-serena mcp-playwright mcp-github mcp-shadcn

# Check logs
docker logs mcp-serena --tail 50

# Test connection
docker exec -i mcp-serena /workspaces/serena/.venv/bin/serena --help

# Full reset
docker stop $(docker ps -q --filter "name=mcp-") && docker rm $(docker ps -a -q --filter "name=mcp-")
```

---

**Version:** 1.0
**Last Updated:** 2025-12-12
**Maintained By:** PinGlass Development Team
