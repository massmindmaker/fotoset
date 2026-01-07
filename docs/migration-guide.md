# Migration Guide: Multi-Provider AI Setup

This guide shows how to migrate from single-provider (Google Imagen) to multi-provider architecture with automatic fallback.

---

## Phase 1: Add Fal.ai as Fallback (Quick Win)

**Time:** 30 minutes
**Risk:** Low
**Benefit:** Redundancy + 2-3x speed improvement

### Step 1: Install Dependencies

```bash
pnpm add @fal-ai/serverless-client
```

### Step 2: Add Environment Variable

```env
# .env.local
FAL_KEY=your_fal_api_key_here
```

Get your API key from: https://fal.ai/dashboard/keys

### Step 3: Update Generate API (Minimal Changes)

Edit `app/api/generate/route.ts`:

```typescript
// Add imports
import { generateImage, getProviderStatus } from "@/lib/ai-orchestrator";

// Replace this:
const imageUrl = await generateWithImagen(promptText, referenceImages);

// With this:
const result = await generateImage({
  prompt: promptText,
  referenceImages: referenceImages,
});
const imageUrl = result.url;
```

That's it! Now you have automatic fallback to Fal.ai if Imagen fails.

---

## Phase 2: Parallel Batch Generation (Speed Optimization)

**Time:** 1 hour
**Risk:** Medium
**Benefit:** 5-10 minutes → 1-2 minutes for 23 images

### Before (Sequential):
```typescript
// Current approach in app/api/generate/route.ts
for (const prompt of prompts) {
  try {
    const imageUrl = await generateWithImagen(prompt.text, referenceImages);
    // Save to DB...
  } catch (error) {
    console.error(`Failed to generate prompt ${prompt.id}:`, error);
  }
}
```

**Total time:** 23 images × 10-15s = 4-6 minutes

### After (Parallel):
```typescript
import { generateBatch, calculateStats } from "@/lib/ai-orchestrator";

// Generate all 23 images in parallel
const results = await generateBatch(
  prompts.map(p => p.text),
  referenceImages[0], // Use first image as reference
  {
    parallel: true,
    preferredProvider: 'fal' // Use Fal.ai for speed
  }
);

// Save successful results to database
for (let i = 0; i < results.length; i++) {
  if (results[i].success && results[i].url) {
    const { data: photo, error } = await db
      .from('generated_photos')
      .insert({
        avatar_id: avatarId,
        style_id: styleId,
        prompt: prompts[i].text,
        image_url: results[i].url,
      })
      .select()
      .single();

    if (!error && photo) {
      generatedPhotos.push(photo);
    }
  }
}

// Log statistics
const stats = calculateStats(results);
console.log(`Generated ${stats.successfulImages}/${stats.totalImages} images`);
console.log(`Total cost: $${stats.totalCost.toFixed(3)}`);
console.log(`Average time: ${(stats.averageGenerationTime / 1000).toFixed(1)}s per image`);
```

**Total time:** ~1-2 minutes (all parallel)

**Expected output:**
```
Generated 23/23 images
Total cost: $0.575
Average time: 3.2s per image
Provider breakdown: { fal: 23 }
```

---

## Phase 3: Cost Optimization (Smart Provider Selection)

**Time:** 2 hours
**Risk:** Medium
**Benefit:** 40-60% cost reduction

### Strategy: Use Different Providers for Different Use Cases

```typescript
import { selectProvider, generateImage } from "@/lib/ai-orchestrator";

// For Pro users: prioritize quality
const proProvider = selectProvider({ prioritizeQuality: true }); // Returns 'imagen'

// For free tier testing: prioritize cost
const freeProvider = selectProvider({ prioritizeCost: true }); // Returns 'fal'

// For preview generations: prioritize speed
const previewProvider = selectProvider({ prioritizeSpeed: true }); // Returns 'fal'

// Use in API - check payment status from payments table
const hasPaid = await checkUserHasPaid(user.id);
const provider = hasPaid ? proProvider : freeProvider;

const result = await generateImage({
  prompt: promptText,
  referenceImages: referenceImages,
}, provider);
```

### Cost Comparison:

| Tier | Provider | Cost per 23 images | Speed |
|------|----------|-------------------|-------|
| Free (preview) | Fal.ai Fast SDXL | $0.35 | 30s |
| Standard | Fal.ai FLUX | $0.58 | 1-2min |
| Pro | Google Imagen | $0.92 | 3-6min |
| Premium | Replicate face-to-many | $3.45 | 5-10min |

---

## Phase 4: A/B Testing (Quality Validation)

**Time:** 1 week (ongoing)
**Risk:** Low
**Benefit:** Data-driven provider selection

### Setup A/B Test

```typescript
import { generateWithABTest } from "@/lib/ai-orchestrator";

// 50/50 split between Fal.ai and Imagen
const result = await generateWithABTest({
  prompt: promptText,
  referenceImages: referenceImages,
}, ['fal', 'imagen']);

// Log which provider was used
await db.from('generation_logs').insert({
  avatar_id: avatarId,
  provider: result.provider,
  generation_time: result.generationTime,
  cost: result.estimatedCost,
  user_rating: null, // To be filled later
});
```

### Track User Satisfaction

Add rating UI to results page:

```typescript
// components/persona-app.tsx
<Button onClick={() => rateGeneration(photo.id, 'thumbs_up')}>
  👍 Love it
</Button>
<Button onClick={() => rateGeneration(photo.id, 'thumbs_down')}>
  👎 Not great
</Button>
```

### Analyze Results After 100 Generations:

```sql
-- Compare satisfaction by provider
SELECT
  provider,
  COUNT(*) as total,
  SUM(CASE WHEN user_rating = 'thumbs_up' THEN 1 ELSE 0 END) as positive,
  AVG(generation_time) as avg_time,
  AVG(cost) as avg_cost
FROM generation_logs
WHERE user_rating IS NOT NULL
GROUP BY provider;
```

**Sample results:**
```
provider | total | positive | avg_time | avg_cost
---------|-------|----------|----------|----------
fal      | 50    | 42       | 3200ms   | $0.025
imagen   | 50    | 45       | 12000ms  | $0.040
```

**Decision:** Fal.ai has 84% satisfaction vs Imagen's 90%, but 4x faster and 37% cheaper. **Winner: Fal.ai** for most users, keep Imagen for Pro tier.

---

## Phase 5: Advanced Features

### Feature 1: Provider Health Monitoring

```typescript
// app/api/health/route.ts
import { healthCheckAll } from "@/lib/ai-orchestrator";

export async function GET() {
  const health = await healthCheckAll();

  return Response.json({
    status: Object.values(health).every(h => h.healthy) ? 'healthy' : 'degraded',
    providers: health,
    timestamp: new Date().toISOString(),
  });
}
```

**Example response:**
```json
{
  "status": "healthy",
  "providers": {
    "fal": { "healthy": true, "latency": 2800 },
    "imagen": { "healthy": true, "latency": 11200 }
  },
  "timestamp": "2025-12-10T10:30:00Z"
}
```

### Feature 2: Cost Estimation Before Generation

```typescript
import { estimateBatchCost } from "@/lib/ai-orchestrator";

// Show user estimated cost before generation
const cost = estimateBatchCost(23, 'fal');

// Display in UI
<PaymentModal>
  <p>Generate 23 AI photos for 500₽</p>
  <p className="text-sm text-gray-500">
    Generation cost: ${cost.preferredCost?.toFixed(2)}
  </p>
</PaymentModal>
```

### Feature 3: Dynamic Provider Selection Based on Load

```typescript
import { getProviderStatus } from "@/lib/ai-orchestrator";

async function selectProviderByLoad() {
  const status = getProviderStatus();

  // Get current queue size from providers
  const loads = await Promise.all(
    status.filter(p => p.enabled).map(async (p) => ({
      provider: p.name,
      queueSize: await getQueueSize(p.name), // Implement per provider
    }))
  );

  // Select provider with smallest queue
  const bestProvider = loads.sort((a, b) => a.queueSize - b.queueSize)[0];

  return bestProvider.provider;
}
```

---

## Testing Checklist

Before deploying to production:

### Unit Tests
```typescript
// __tests__/ai-orchestrator.test.ts
import { generateImage, generateBatch, selectProvider } from '@/lib/ai-orchestrator';

describe('AI Orchestrator', () => {
  it('should fallback to secondary provider on failure', async () => {
    // Mock primary provider to fail
    const result = await generateImage({
      prompt: 'test prompt',
      referenceImages: [],
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('fal'); // Should fallback to Fal.ai
  });

  it('should generate batch in parallel', async () => {
    const prompts = Array(23).fill('test prompt');
    const startTime = Date.now();

    const results = await generateBatch(prompts, undefined, { parallel: true });

    const duration = Date.now() - startTime;

    expect(results.length).toBe(23);
    expect(duration).toBeLessThan(60000); // Should complete in under 1 minute
  });

  it('should select cheapest provider', () => {
    const provider = selectProvider({ prioritizeCost: true });
    expect(provider).toBe('fal');
  });
});
```

### Integration Tests
```bash
# Test full generation flow
npm run test:integration

# Test with real APIs (use test mode)
FAL_KEY=test_key npm run test:real-api
```

### Load Tests
```typescript
// __tests__/load.test.ts
import { generateBatch } from '@/lib/ai-orchestrator';

describe('Load Tests', () => {
  it('should handle 100 concurrent generations', async () => {
    const batches = Array(100).fill(null).map(() =>
      generateBatch(['test prompt'], undefined, { parallel: true })
    );

    const results = await Promise.all(batches);

    const successRate = results.flat().filter(r => r.success).length / 100;
    expect(successRate).toBeGreaterThan(0.95); // 95% success rate
  });
});
```

---

## Rollback Plan

If issues occur after deployment:

### Immediate Rollback (5 minutes)

```typescript
// app/api/generate/route.ts

// Comment out new code:
// import { generateImage } from "@/lib/ai-orchestrator";
// const result = await generateImage({ ... });

// Restore old code:
import { generateWithImagen } from "@/lib/imagen";
const imageUrl = await generateWithImagen(promptText, referenceImages);
```

### Disable Provider (1 minute)

```env
# .env.local
# FAL_KEY=... # Comment out to disable
```

Or in code:

```typescript
// lib/ai-orchestrator.ts
const PROVIDERS: ProviderConfig[] = [
  {
    name: "fal",
    enabled: false, // ← Change this
    // ...
  },
];
```

### Monitor for Issues

```bash
# Watch error logs
vercel logs --follow

# Check error rate
vercel logs --since 1h | grep "ERROR"
```

---

## Monitoring & Alerts

### Key Metrics to Track

1. **Generation Success Rate**
   - Target: >95%
   - Alert if: <90% for 10 minutes

2. **Average Generation Time**
   - Target: <5 seconds per image
   - Alert if: >15 seconds for 10 minutes

3. **Cost Per Generation**
   - Target: <$1.00 per 23 images
   - Alert if: >$1.50

4. **Provider Health**
   - Target: All providers healthy
   - Alert if: Primary provider down >5 minutes

### Setup Vercel Analytics

```typescript
// app/api/generate/route.ts
import { track } from '@vercel/analytics';

// Track generation metrics
track('ai_generation', {
  provider: result.provider,
  success: result.success,
  generationTime: result.generationTime,
  cost: result.estimatedCost,
});
```

### Dashboard

Create monitoring dashboard at `/admin/ai-metrics`:

```typescript
// app/admin/ai-metrics/page.tsx
export default async function AIMetrics() {
  const last24h = await db.query(`
    SELECT
      provider,
      COUNT(*) as total_generations,
      AVG(generation_time) as avg_time,
      SUM(cost) as total_cost,
      SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*) as success_rate
    FROM generation_logs
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY provider
  `);

  return (
    <div>
      <h1>AI Generation Metrics (Last 24h)</h1>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Generations</th>
            <th>Success Rate</th>
            <th>Avg Time</th>
            <th>Total Cost</th>
          </tr>
        </thead>
        <tbody>
          {last24h.map(row => (
            <tr key={row.provider}>
              <td>{row.provider}</td>
              <td>{row.total_generations}</td>
              <td>{(row.success_rate * 100).toFixed(1)}%</td>
              <td>{(row.avg_time / 1000).toFixed(1)}s</td>
              <td>${row.total_cost.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Expected Results

After full migration:

| Metric | Before (Imagen Only) | After (Multi-Provider) | Improvement |
|--------|---------------------|------------------------|-------------|
| **Generation Time** | 4-6 minutes | 1-2 minutes | 3-4x faster |
| **Cost per Session** | $0.92 | $0.46-0.58 | 40-50% cheaper |
| **Success Rate** | 92% | 97% | +5% (fallback) |
| **Availability** | 99.0% | 99.9% | Better uptime |

### Cost Savings Projection

Assuming 1,000 users per month:

- **Before:** 1,000 × $0.92 = $920/month
- **After:** 1,000 × $0.58 = $580/month
- **Savings:** $340/month ($4,080/year)

---

## Next Steps

1. ✅ Read this migration guide
2. ⬜ Set up Fal.ai account and get API key
3. ⬜ Install dependencies (`pnpm add @fal-ai/serverless-client`)
4. ⬜ Add `FAL_KEY` to `.env.local`
5. ⬜ Test Fal.ai integration locally
6. ⬜ Update generate API to use orchestrator
7. ⬜ Deploy to staging environment
8. ⬜ Run integration tests
9. ⬜ A/B test for 1 week
10. ⬜ Analyze results and adjust
11. ⬜ Full rollout to production
12. ⬜ Monitor metrics for 2 weeks

---

## Support

If you encounter issues:

1. Check provider status: `GET /api/health`
2. Review logs in Vercel dashboard
3. Test individual providers in isolation
4. Rollback to single provider if needed
5. File issue with detailed error logs

**Estimated total migration time:** 1-2 weeks (including testing)
