#!/bin/bash
# MCP Health Check Script for PinGlass (Fotoset)
# Version: 1.0
# Last Updated: 2025-12-12

echo "================================================"
echo "    MCP Health Check - PinGlass (Fotoset)"
echo "================================================"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Docker Containers
echo "=== Docker MCP Containers ==="
docker ps --filter "name=mcp-" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" 2>&1

echo ""
echo "=== Container Health Details ==="
for container in mcp-serena mcp-playwright mcp-github mcp-shadcn; do
  if docker ps -q -f name=$container 2>&1 > /dev/null; then
    status=$(docker inspect $container --format '{{.State.Status}}' 2>&1)
    echo "$container: $status"
  else
    echo "$container: NOT RUNNING"
  fi
done

echo ""
echo "=== npx MCP Servers ==="

# Neon
echo -n "Neon (@neondatabase/mcp-server-neon): "
if npx -y @neondatabase/mcp-server-neon --help > /dev/null 2>&1; then
  echo "OK"
else
  echo "FAILED"
fi

# Memory
echo -n "Memory (@modelcontextprotocol/server-memory): "
if npx -y @modelcontextprotocol/server-memory --help > /dev/null 2>&1; then
  echo "OK"
else
  echo "FAILED"
fi

# Context7
echo -n "Context7 (@upstash/context7-mcp): "
if npx -y @upstash/context7-mcp@latest --help > /dev/null 2>&1; then
  echo "OK"
else
  echo "FAILED"
fi

# Exa
echo -n "Exa (exa-mcp-server): "
if npx -y exa-mcp-server --help > /dev/null 2>&1; then
  echo "OK"
else
  echo "FAILED"
fi

echo ""
echo "=== Environment Variables ==="
if [ -f .env.local ]; then
  echo "✓ .env.local exists"

  # Check required keys (without exposing values)
  if grep -q "NEON_API_KEY=" .env.local; then
    echo "✓ NEON_API_KEY configured"
  else
    echo "✗ NEON_API_KEY missing"
  fi

  if grep -q "GITHUB_PAT=" .env.local || [ -n "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
    echo "✓ GITHUB_PAT configured"
  else
    echo "✗ GITHUB_PAT missing"
  fi

  if grep -q "EXA_API_KEY=" .env.local; then
    echo "✓ EXA_API_KEY configured"
  else
    echo "⚠ EXA_API_KEY missing (optional)"
  fi
else
  echo "✗ .env.local not found"
fi

echo ""
echo "=== MCP Configuration ==="
if [ -f .mcp.json ]; then
  version=$(grep '"version"' .mcp.json | head -1 | cut -d'"' -f4)
  updated=$(grep '"updated"' .mcp.json | head -1 | cut -d'"' -f4)
  echo "✓ .mcp.json exists"
  echo "  Version: ${version:-1.0}"
  echo "  Updated: ${updated:-unknown}"

  server_count=$(grep -c '"command"' .mcp.json)
  echo "  Servers configured: $server_count"
else
  echo "✗ .mcp.json not found"
fi

echo ""
echo "=== Documentation ==="
docs_dir=".serena/docs"
if [ -d "$docs_dir" ]; then
  echo "✓ Documentation directory exists"

  doc_files=("MCP_SERVERS_GUIDE.md" "MCP_TROUBLESHOOTING.md" "MCP_BEST_PRACTICES.md" "MCP_OPTIMIZATION_SUMMARY.md")
  for doc in "${doc_files[@]}"; do
    if [ -f "$docs_dir/$doc" ]; then
      size=$(wc -l < "$docs_dir/$doc")
      echo "  ✓ $doc ($size lines)"
    else
      echo "  ✗ $doc missing"
    fi
  done
else
  echo "✗ Documentation directory not found"
fi

echo ""
echo "=== Quick Diagnostics ==="

# Check disk space
disk_usage=$(df -h . | tail -1 | awk '{print $5}')
echo "Disk usage: $disk_usage"

# Check Docker daemon
if docker info > /dev/null 2>&1; then
  echo "✓ Docker daemon running"
else
  echo "✗ Docker daemon not running"
fi

# Check npm cache
cache_size=$(du -sh ~/.npm 2>/dev/null | cut -f1)
echo "npm cache size: ${cache_size:-unknown}"

echo ""
echo "=== Recommendations ==="

# Check for stopped containers
stopped=$(docker ps -a -q --filter "name=mcp-" --filter "status=exited" | wc -l)
if [ $stopped -gt 0 ]; then
  echo "⚠ $stopped MCP container(s) stopped - restart with:"
  echo "  docker start \$(docker ps -a -q --filter \"name=mcp-\" --filter \"status=exited\")"
fi

# Check shadcn status
if docker ps -q -f name=mcp-shadcn > /dev/null 2>&1; then
  health=$(docker inspect mcp-shadcn --format '{{.State.Health.Status}}' 2>&1 || echo "none")
  if [ "$health" = "unhealthy" ]; then
    echo "ℹ shadcn unhealthy status is EXPECTED (SSE mode)"
  fi
fi

echo ""
echo "================================================"
echo "Health check complete!"
echo "================================================"
echo ""
echo "For detailed troubleshooting, see:"
echo "  .serena/docs/MCP_TROUBLESHOOTING.md"
echo ""
