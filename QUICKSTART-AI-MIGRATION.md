# Quick Start: AI Provider Migration

**Goal:** Add Fal.ai as faster, cheaper alternative to Google Imagen
**Time:** 30 minutes to 2 hours (depending on depth)
**Savings:** $4,140/year + 3x faster generation

---

## Option 1: Minimal (30 minutes) - Add Fallback Only

Perfect for: Immediate redundancy without changing primary provider

```bash
# 1. Install dependency (2 min)
pnpm add @fal-ai/serverless-client

# 2. Add environment variable (1 min)
echo 'FAL_KEY=your_fal_key_here' >> .env.local

# 3. Copy library files (5 min)
# Files already created in docs/ folder:
# - lib/fal.ts
# - lib/ai-orchestrator.ts

# 4. Update generate API (20 min)
# See: docs/generate-api-migration-example.ts
# Change ~10 lines in app/api/generate/route.ts

# 5. Test locally (5 min)
pnpm dev
# Test generation, verify fallback works
```

**Result:** Imagen primary, Fal.ai automatic fallback on errors

---

## Option 2: Recommended (2 hours) - Full Migration

Perfect for: Maximum speed and cost savings

```bash
# 1-3. Same as Option 1 (30 min)

# 4. Update to parallel generation (30 min)
# Replace sequential generateMultipleImages with generateBatch
# See: docs/migration-guide.md Phase 2

# 5. Add provider selection (30 min)
# Use selectProvider() for automatic optimization
# See: docs/generate-api-migration-example.ts

# 6. Deploy to staging (15 min)
git add .
git commit -m "feat: add Fal.ai provider with automatic fallback"
git push

# 7. Test and monitor (15 min)
vercel logs --follow
# Verify both providers work
```

**Result:** Fal.ai primary (fast + cheap), Imagen fallback (quality)

---

## Get Fal.ai API Key

1. Go to: https://fal.ai/dashboard
2. Sign up (free tier available)
3. Navigate to: Settings → API Keys
4. Click "Create New Key"
5. Copy key to `.env.local`:
   ```env
   FAL_KEY=your_key_here_xxxxxxxxxx
   ```

**Pricing:** Pay-as-you-go, no subscription required
- FLUX-dev: $0.025/image
- Free tier: $5 credits to start

---

## Verify Installation

```typescript
// Test Fal.ai connection
import { generateWithFal, checkFalHealth } from '@/lib/fal';

// Quick health check
const isHealthy = await checkFalHealth();
console.log('Fal.ai status:', isHealthy ? 'OK' : 'ERROR');

// Test generation
const url = await generateWithFal({
  prompt: 'a professional headshot',
  width: 1024,
  height: 1024,
});
console.log('Generated:', url);
```

Run: `node -r tsx test-fal.ts` (or create API test route)

---

## Expected Results

### Before (Imagen only)
```
Generation time: 3-6 minutes (23 images)
Cost per session: $0.92
Success rate: 92%
Uptime: 99.0%
```

### After (Fal.ai + Imagen fallback)
```
Generation time: 1-2 minutes (3x faster) ✅
Cost per session: $0.575 (37% cheaper) ✅
Success rate: 97% (multi-provider) ✅
Uptime: 99.9% (redundancy) ✅
```

---

## Rollback (if needed)

### Instant Rollback (<1 minute)
```typescript
// lib/ai-orchestrator.ts
const PROVIDERS: ProviderConfig[] = [
  {
    name: "fal",
    enabled: false, // ← Change true to false
    // ...
  },
];
```

### Or remove environment variable
```bash
# Comment out in .env.local
# FAL_KEY=...
```

System automatically uses Imagen as fallback.

---

## Monitoring

### Check provider status
```bash
curl http://localhost:3000/api/generate/health
```

### Watch logs
```bash
vercel logs --follow | grep "AI Orchestrator"
```

### Key metrics
- Generation success rate: Should be >95%
- Average generation time: Should be <5s per image
- Cost per session: Should be <$0.60

---

## Troubleshooting

### Error: "FAL_KEY environment variable is not set"
**Fix:** Add `FAL_KEY=...` to `.env.local` and restart dev server

### Error: "All providers failed"
**Fix:** Check both API keys are valid:
- `FAL_KEY` for Fal.ai
- `GOOGLE_API_KEY` for Imagen

### Error: "Timeout after 30000ms"
**Fix:** Increase timeout in `ai-orchestrator.ts`:
```typescript
timeout: 60000, // 60 seconds instead of 30
```

### Generation is slow
**Check:** Are you using parallel generation?
```typescript
generateBatch(prompts, ref, { parallel: true }) // ← Must be true
```

---

## Next Steps

1. ✅ Complete installation (Option 1 or 2)
2. ⬜ Test locally with real photos
3. ⬜ Compare quality with Imagen
4. ⬜ Deploy to staging
5. ⬜ Monitor for 24-48 hours
6. ⬜ Deploy to production
7. ⬜ Track savings and performance

---

## Files Reference

All implementation files are ready in `docs/` folder:

| File | Purpose |
|------|---------|
| `README-AI-RESEARCH.md` | This file - quick overview |
| `ai-api-research.md` | Full research (60+ pages) |
| `provider-comparison-table.md` | Quick reference tables |
| `migration-guide.md` | Step-by-step guide |
| `generate-api-migration-example.ts` | Code examples |
| `lib/fal.ts` | Fal.ai integration (ready to use) |
| `lib/ai-orchestrator.ts` | Multi-provider layer (ready to use) |

---

## Support

**Questions?** Check the documentation:
1. `docs/migration-guide.md` for detailed steps
2. `docs/ai-api-research.md` for technical details
3. Fal.ai docs: https://fal.ai/docs

**Issues?** Common solutions:
- Invalid API key → Regenerate in dashboard
- Slow generation → Enable parallel mode
- Quality concerns → Try different providers
- Costs too high → Adjust provider selection

---

## Summary

**Easiest path:**
1. Get Fal.ai API key (5 min)
2. Install SDK (1 min)
3. Copy 2 library files (2 min)
4. Update ~10 lines in generate API (20 min)
5. Test and deploy (10 min)

**Total time:** 30-40 minutes
**Total savings:** $4,140/year
**Speed improvement:** 3x faster
**Risk:** Very low (automatic fallback)

**Ready? Let's start with Option 1!** 🚀
