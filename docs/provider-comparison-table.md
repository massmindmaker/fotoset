# AI Provider Quick Reference (2025)

## Summary Table

| Provider | Best Model | Speed ⚡ | Cost 💰 | Quality ⭐ | Face Consistency 👤 | API Access | Recommendation |
|----------|-----------|---------|---------|-----------|---------------------|------------|----------------|
| **Fal.ai** | FLUX-dev | ⚡⚡⚡⚡⚡<br>2-5s | 💰💰<br>$0.025 | ⭐⭐⭐⭐<br>Very Good | 👤👤👤👤<br>Good w/ PhotoMaker | ✅ Public API | **Best Overall** |
| **Fireworks** | FLUX-dev | ⚡⚡⚡⚡<br>3-7s | 💰<br>$0.020 | ⭐⭐⭐⭐<br>Very Good | 👤👤👤<br>Limited | ✅ Public API | Best Value |
| **Google Imagen 3** | Imagen 3.0 | ⚡⚡<br>8-15s | 💰💰💰<br>$0.040 | ⭐⭐⭐⭐⭐<br>Excellent | 👤👤👤👤👤<br>Excellent | ✅ Public API | Current (Premium) |
| **Replicate** | face-to-many | ⚡⚡<br>20-40s | 💰💰💰💰💰<br>$0.15 | ⭐⭐⭐⭐⭐<br>Excellent | 👤👤👤👤👤<br>Best | ✅ Public API | Best Consistency |
| **Stability AI** | SD3.5 Large | ⚡⚡⚡<br>5-10s | 💰💰💰<br>$0.065 | ⭐⭐⭐⭐<br>Very Good | 👤👤👤<br>Decent | ✅ Public API | Enterprise Choice |
| **Together AI** | FLUX-dev | ⚡⚡<br>8-15s | 💰💰<br>$0.025 | ⭐⭐⭐⭐<br>Very Good | 👤👤👤<br>Limited | ✅ Public API | Good Alternative |
| **Leonardo AI** | PhotoReal | ⚡⚡<br>10-15s | 💰💰💰💰<br>Subscription | ⭐⭐⭐⭐⭐<br>Excellent | 👤👤👤👤<br>Very Good | ⚠️ Enterprise Only | Not Recommended |
| **Midjourney** | v6 | ⚡<br>30-60s | 💰💰💰<br>Subscription | ⭐⭐⭐⭐⭐<br>Excellent | 👤👤👤👤<br>Good | ❌ No Official API | Not Available |
| **RunwayML** | Gen-3 | ⚡<br>Variable | 💰💰💰💰<br>Video focus | ⭐⭐⭐<br>Good | 👤👤<br>Limited | ✅ Limited API | Not Recommended |

---

## Cost Analysis: 23 Images per User

| Provider | Per Image | Per Session (23) | Monthly (1k users) | Yearly (1k users) | vs Imagen Savings |
|----------|-----------|------------------|-------------------|-------------------|-------------------|
| **Fireworks FLUX** | $0.020 | **$0.46** | $460 | $5,520 | **$4,560/year** (50%) |
| **Fal.ai FLUX** | $0.025 | **$0.575** | $575 | $6,900 | **$3,180/year** (37%) |
| **Together FLUX** | $0.025 | **$0.575** | $575 | $6,900 | **$3,180/year** (37%) |
| **Google Imagen 3** | $0.040 | **$0.92** | $920 | $11,040 | (baseline) |
| **Stability SD3.5** | $0.065 | **$1.50** | $1,500 | $18,000 | **-$6,960/year** (63% more) |
| **Replicate face-to-many** | $0.150 | **$3.45** | $3,450 | $41,400 | **-$30,360/year** (275% more) |

---

## Speed Analysis: Total Generation Time

Assuming parallel generation where possible:

| Provider | Single Image | Sequential (23) | Parallel (23) | Speedup |
|----------|--------------|-----------------|---------------|---------|
| **Fal.ai Fast SDXL** | <1s | 23s | **~30s** | 12x faster |
| **Fal.ai FLUX** | 2-5s | 1-2 min | **~1-2 min** | 3-4x faster |
| **Fireworks FLUX** | 3-7s | 1-3 min | **~1-3 min** | 2-3x faster |
| **Replicate SDXL Lightning** | 2-5s | 1-2 min | **~1-2 min** | 3-4x faster |
| **Together FLUX** | 8-15s | 3-6 min | **~3-6 min** | 1x (same) |
| **Google Imagen 3** | 8-15s | 3-6 min | **~3-6 min** | (baseline) |
| **Stability SD3.5** | 5-10s | 2-4 min | **~2-4 min** | 1.5-2x faster |
| **Replicate face-to-many** | 20-40s | 8-15 min | **~8-15 min** | 0.5x (slower) |

---

## Quality Comparison

Based on portrait generation capabilities:

### Tier S (Best-in-Class)
- **Google Imagen 3** - Most photorealistic, excellent face details
- **Replicate face-to-many** - Purpose-built for face consistency
- **Leonardo PhotoReal** - Top-tier for business portraits

### Tier A (Excellent)
- **Fal.ai FLUX-dev** - Near-perfect quality, fast
- **Replicate FLUX-dev** - Same quality as Fal.ai
- **Fireworks FLUX-dev** - Same model, optimized serving

### Tier B (Very Good)
- **Stability SD3.5** - Solid quality, slight artifacts
- **Together FLUX-dev** - Good quality, consistent
- **Fal.ai PhotoMaker** - Good personalization

### Tier C (Good)
- **Fal.ai Fast SDXL** - Lower quality but very fast
- **Various SDXL models** - Decent for previews

---

## Face Consistency Ranking

Critical for PinGlass's multi-shot portrait generation:

1. **⭐⭐⭐⭐⭐ Replicate face-to-many**
   - Purpose-built for maintaining same face across images
   - Best for character consistency
   - Expensive but worth it for premium tier

2. **⭐⭐⭐⭐⭐ Google Imagen 3**
   - Excellent reference image support
   - Current provider - proven quality
   - Consistent results across variations

3. **⭐⭐⭐⭐ Fal.ai PhotoMaker**
   - Specialized for personalized portraits
   - Good face consistency with multiple references
   - Better than generic FLUX

4. **⭐⭐⭐⭐ Replicate FLUX + IP-Adapter**
   - Very good with proper setup
   - Requires additional configuration
   - Flexible and customizable

5. **⭐⭐⭐ Fal.ai FLUX-dev (standard)**
   - Decent consistency with reference images
   - Fast and affordable
   - Good for most use cases

6. **⭐⭐⭐ Stability SD3.5 + img2img**
   - Acceptable consistency
   - Needs careful prompting
   - Enterprise-grade infrastructure

7. **⭐⭐ Fireworks/Together FLUX**
   - Limited reference image support
   - Text-to-image focused
   - Less consistent across batches

---

## Use Case Recommendations

### For PinGlass (Portrait Generation with Face Consistency)

**Recommended Setup:**

```typescript
const PROVIDER_STRATEGY = {
  // Free tier / Preview
  preview: {
    provider: 'fal',
    model: 'fast-sdxl',
    cost: '$0.35 per 23 images',
    speed: '~30 seconds',
    quality: 'Good enough for previews',
  },

  // Standard tier (most users)
  standard: {
    provider: 'fal',
    model: 'flux-dev',
    cost: '$0.58 per 23 images',
    speed: '~1-2 minutes',
    quality: 'Excellent, production-ready',
  },

  // Pro tier (paid users)
  pro: {
    provider: 'imagen',
    model: 'imagen-3',
    cost: '$0.92 per 23 images',
    speed: '~3-6 minutes',
    quality: 'Best-in-class',
  },

  // Premium tier (future)
  premium: {
    provider: 'replicate',
    model: 'face-to-many',
    cost: '$3.45 per 23 images',
    speed: '~8-15 minutes',
    quality: 'Perfect face consistency',
  },
};
```

---

## API Integration Difficulty

| Provider | Setup Time | Complexity | Documentation | NPM Package |
|----------|------------|------------|---------------|-------------|
| **Fal.ai** | 15 min | ⭐ Easy | ⭐⭐⭐⭐⭐ Excellent | `@fal-ai/serverless-client` |
| **Replicate** | 20 min | ⭐ Easy | ⭐⭐⭐⭐⭐ Excellent | `replicate` |
| **Fireworks** | 15 min | ⭐ Easy | ⭐⭐⭐⭐ Good | OpenAI-compatible |
| **Together** | 15 min | ⭐ Easy | ⭐⭐⭐⭐ Good | OpenAI-compatible |
| **Stability** | 30 min | ⭐⭐ Medium | ⭐⭐⭐⭐ Good | REST API |
| **Imagen** | 20 min | ⭐⭐ Medium | ⭐⭐⭐ Decent | Google Cloud SDK |
| **Leonardo** | N/A | ⭐⭐⭐⭐ Hard | ⭐⭐ Limited | Enterprise only |

---

## Feature Matrix

| Feature | Fal.ai | Replicate | Fireworks | Together | Stability | Imagen |
|---------|--------|-----------|-----------|----------|-----------|--------|
| **Text-to-Image** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Image-to-Image** | ✅ | ✅ | ⚠️ Limited | ⚠️ Limited | ✅ | ✅ |
| **Reference Images** | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Face Consistency** | ✅ PhotoMaker | ✅ face-to-many | ❌ | ❌ | ⚠️ Via img2img | ✅ Built-in |
| **Batch Generation** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Async/Webhooks** | ✅ | ✅ | ❌ | ❌ | ⚠️ Limited | ⚠️ Limited |
| **NSFW Filtering** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Custom LoRA** | ⚠️ Limited | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Fine-tuning** | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Queue Management** | ✅ Built-in | ✅ Built-in | ❌ | ❌ | ❌ | ❌ |
| **Real-time Logs** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Infrastructure & Reliability

| Provider | Uptime | Rate Limits | Geographic | Support |
|----------|--------|-------------|------------|---------|
| **Fal.ai** | 99.9% | Generous | Global CDN | Discord + Email |
| **Replicate** | 99.9% | Per-model | US-focused | Email + Docs |
| **Fireworks** | 99.95% | High | Global | Email |
| **Together** | 99.9% | Medium | US-focused | Email |
| **Stability** | 99.95% | Enterprise | Global | Enterprise support |
| **Google Imagen** | 99.95% | Per quota | Global | Google Cloud support |

---

## Final Recommendations

### 🥇 Best Overall: **Fal.ai FLUX-dev**
- **Why:** Perfect balance of speed (2-5s), cost ($0.025), and quality
- **Best for:** 90% of PinGlass use cases
- **Switch from Imagen:** Save 37% on costs, 3-4x faster

### 🥈 Best Value: **Fireworks FLUX-dev**
- **Why:** Cheapest ($0.020), still very fast (3-7s)
- **Best for:** High-volume applications
- **Switch from Imagen:** Save 50% on costs

### 🥉 Best Quality: **Google Imagen 3** (current)
- **Why:** Best photorealism and face consistency
- **Best for:** Pro users, premium tier
- **Keep for:** Users willing to pay for quality

### 🏆 Best Consistency: **Replicate face-to-many**
- **Why:** Purpose-built for maintaining face across variations
- **Best for:** Future premium tier
- **Use when:** Perfect consistency is required

---

## Migration Path (Recommended)

```
Week 1: Add Fal.ai as fallback
  ↓
Week 2: A/B test Fal vs Imagen (50/50)
  ↓
Week 3: Analyze results, adjust split
  ↓
Week 4: Full migration to Fal.ai
  ↓
Ongoing: Keep Imagen for Pro tier only
```

**Expected outcome:**
- 40% cost reduction
- 3x faster generation
- Better uptime (multi-provider redundancy)
- Maintained quality

---

## Quick Start Commands

### Fal.ai
```bash
pnpm add @fal-ai/serverless-client
```
```typescript
import * as fal from "@fal-ai/serverless-client";
const result = await fal.subscribe("fal-ai/flux/dev", { input: { prompt } });
```

### Replicate
```bash
pnpm add replicate
```
```typescript
import Replicate from "replicate";
const output = await replicate.run("black-forest-labs/flux-dev", { input: { prompt } });
```

### Fireworks
```bash
# No package needed, use fetch
```
```typescript
fetch('https://api.fireworks.ai/inference/v1/image_generation/...', {
  headers: { Authorization: `Bearer ${key}` },
  body: JSON.stringify({ prompt })
});
```

---

## Resources

- **Fal.ai:** https://fal.ai/models
- **Replicate:** https://replicate.com/explore
- **Fireworks:** https://fireworks.ai/models
- **Together:** https://together.ai/models
- **Stability:** https://platform.stability.ai
- **Imagen:** https://cloud.google.com/vertex-ai/generative-ai/docs/image/overview

---

**Last Updated:** 2025-12-10
**Next Review:** 2025-Q2 (new models expected)
