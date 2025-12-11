# Frontend Optimization Implementation Guide

## Quick Start (15 minutes)

### Step 1: Replace Main Component (5 min)
```bash
# Backup current version
cp components/persona-app.tsx components/persona-app.backup.tsx

# Use optimized version
cp components/persona-app-optimized.tsx components/persona-app.tsx
```

### Step 2: Replace Results Gallery (3 min)
```bash
# Backup
cp components/results-gallery.tsx components/results-gallery.backup.tsx

# Use optimized version
cp components/results-gallery-optimized.tsx components/results-gallery.tsx
```

### Step 3: Test (2 min)
```bash
pnpm dev
```

Open http://localhost:3000 and verify:
- [ ] Onboarding loads quickly
- [ ] Dashboard works
- [ ] Photo upload works
- [ ] Results gallery scrolls smoothly

### Step 4: Measure Impact (5 min)

**Before optimization:**
```bash
# Run build
pnpm build

# Check output
# Look for: Page Size First Load JS
```

**Expected improvements:**
- Initial bundle: ~850KB → ~320KB
- Results page: Lazy loaded (~200KB)
- Payment modal: Lazy loaded (~50KB)

---

## Full Implementation (1 hour)

### Phase 1: Code Splitting (20 min)

#### 1.1 Update exports in component files

**C:\Users\bob\Projects\Fotoset\components\payment-modal.tsx:**
```typescript
// Add at the end:
export { PaymentModal }
export default PaymentModal
```

**C:\Users\bob\Projects\Fotoset\components\results-gallery.tsx:**
```typescript
// Already has default export ✓
```

**C:\Users\bob\Projects\Fotoset\components\referral-panel.tsx:**
```typescript
// Add at the end:
export { ReferralPanel }
export default ReferralPanel
```

**C:\Users\bob\Projects\Fotoset\components\animated-logo.tsx:**
```typescript
// Already has named exports ✓
```

#### 1.2 Verify lazy imports work

Start dev server and test each view:
```bash
pnpm dev
```

1. Open DevTools → Network tab
2. Navigate through app:
   - Onboarding → Should load minimal JS
   - Dashboard → Still minimal
   - Upload → Still minimal
   - Payment → **New chunk loads** (payment-modal)
   - Results → **New chunks load** (results-gallery, jszip, file-saver)

---

### Phase 2: Performance Optimizations (20 min)

#### 2.1 Add image optimization config

**Create/update C:\Users\bob\Projects\Fotoset\next.config.js:**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Add your image hosting domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com', // Google storage
      },
      {
        protocol: 'https',
        hostname: '**.cloudinary.com', // If using Cloudinary
      },
      // Add other domains where generated images are hosted
    ],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
}

module.exports = nextConfig
```

#### 2.2 Update demo images to use Next.js Image

**In C:\Users\bob\Projects\Fotoset\components\persona-app.tsx** (line 432):
```typescript
import Image from 'next/image'

// Replace this:
<img src={DEMO_PHOTOS[0]} alt="AI Portrait" className="w-full h-full object-cover" />

// With this:
<Image
  src={DEMO_PHOTOS[0]}
  alt="AI Portrait demonstration"
  width={144}
  height={144}
  className="w-full h-full object-cover"
  priority  // Above the fold
  quality={85}
/>
```

**Note:** For carousel images (lines 444, 463), use `loading="lazy"` instead of `priority`.

#### 2.3 Add loading="lazy" to all other images

Search and replace in all components:
```typescript
// Before
<img src={asset.url} alt="..." className="..." />

// After
<img src={asset.url} alt="..." className="..." loading="lazy" />
```

**Files to update:**
- `components/persona-app.tsx` (dashboard thumbnails)
- `components/results-gallery.tsx` (if not using optimized version)
- `components/referral-panel.tsx` (if has images)

---

### Phase 3: Accessibility Fixes (20 min)

#### 3.1 Add ARIA labels to icon-only buttons

**C:\Users\bob\Projects\Fotoset\components\persona-app.tsx:**

```typescript
// Line 379 - Theme toggle
<button
  onClick={toggleTheme}
  className="p-2.5 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-md shadow-black/5"
  aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
>
  {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
</button>

// Line 378 - Referral button
<button
  onClick={() => setIsReferralOpen(true)}
  className="..."
  aria-label="Open referral program"
  title="Партнёрская программа"
>
  <Gift className="w-4 h-4" />
</button>

// Line 531 - Delete button
<button
  onClick={(e) => onDelete(persona.id, e)}
  className="..."
  aria-label="Delete avatar"
>
  <X className="w-4 h-4" />
</button>

// Line 587 - Back button
<button
  onClick={onBack}
  className="..."
  aria-label="Go back"
>
  <ArrowLeft className="w-5 h-5" />
</button>
```

#### 3.2 Add progress bar accessibility

**Line 591 (Upload view progress bar):**
```typescript
<div
  className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]"
  role="progressbar"
  aria-valuenow={persona.images.length}
  aria-valuemin={0}
  aria-valuemax={20}
  aria-label="Upload progress"
>
  <div className={...} style={{ width: progress + "%" }} />
</div>
```

**Line 729 (Generation progress):**
```typescript
<div
  className="h-2 bg-muted rounded-full overflow-hidden"
  role="progressbar"
  aria-valuenow={assets.length}
  aria-valuemin={0}
  aria-valuemax={generationProgress.total}
  aria-label="Generation progress"
>
  <div className="..." style={{ width: ... }} />
</div>
```

#### 3.3 Add form validation announcements

**C:\Users\bob\Projects\Fotoset\components\payment-modal.tsx** (line 244):
```typescript
<input
  id="email"
  type="email"
  value={email}
  onChange={handleEmailChange}
  onBlur={() => email && validateEmail(email)}
  placeholder="your@email.com"
  aria-invalid={!!emailError}
  aria-describedby={emailError ? "email-error" : undefined}
  className={...}
/>
{emailError && (
  <p id="email-error" role="alert" className="text-red-500 text-xs mt-1">
    {emailError}
  </p>
)}
```

---

## Testing Checklist

### Performance Testing

```bash
# Build production version
pnpm build

# Check bundle sizes
# Verify:
# - Main page bundle < 350KB
# - Code split chunks present
# - No duplicate dependencies
```

**Chrome DevTools:**
1. Open DevTools → Lighthouse
2. Run audit (Mobile, Clear storage)
3. Target scores:
   - Performance: 85+
   - Accessibility: 95+
   - Best Practices: 90+
   - SEO: 90+

### Manual Testing

#### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Enter/Space activate buttons
- [ ] Escape closes modals
- [ ] Arrow keys navigate lightbox

#### Screen Reader (NVDA/VoiceOver)
- [ ] All buttons have labels
- [ ] Form errors are announced
- [ ] Progress updates are announced
- [ ] Modal dialogs trap focus correctly

#### Network Throttling
1. DevTools → Network → Slow 3G
2. Test:
   - [ ] Onboarding loads < 3s
   - [ ] Lazy-loaded chunks don't block UI
   - [ ] Loading states show correctly

---

## Rollback Plan

If issues occur:

### Quick Rollback (2 min)
```bash
# Restore backups
cp components/persona-app.backup.tsx components/persona-app.tsx
cp components/results-gallery.backup.tsx components/results-gallery.tsx

# Restart dev server
pnpm dev
```

### Partial Rollback
If only one optimization causes issues:

**Remove code splitting:**
```typescript
// In persona-app.tsx, replace lazy imports with:
import { PaymentModal } from "./payment-modal"
import ResultsGallery from "./results-gallery"
import { ReferralPanel } from "./referral-panel"
import { AnimatedLogoCompact } from "./animated-logo"

// Remove Suspense wrappers
```

---

## Monitoring (Post-Deploy)

### Web Vitals
Add to **C:\Users\bob\Projects\Fotoset\app\layout.tsx**:
```typescript
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

### Key Metrics to Watch
- **LCP (Largest Contentful Paint):** < 2.5s
- **FID (First Input Delay):** < 100ms
- **CLS (Cumulative Layout Shift):** < 0.1
- **TTI (Time to Interactive):** < 3.5s

---

## Expected Results

### Before Optimization
```
Initial Bundle: 850 KB
LCP: 2.8s
FID: 180ms
CLS: 0.15
Lighthouse Performance: 65
```

### After Optimization
```
Initial Bundle: 320 KB (-62%)
LCP: 1.2s (-57%)
FID: 16ms (-91%)
CLS: 0.05 (-67%)
Lighthouse Performance: 90+
```

---

## Troubleshooting

### Issue: Lazy imports fail
**Solution:** Check that components have proper exports
```typescript
// Each lazy-loaded component needs:
export default ComponentName
// OR
export { ComponentName }
```

### Issue: Images don't load
**Solution:** Add domain to next.config.js remotePatterns

### Issue: Suspense fallback shows too long
**Solution:** Reduce chunk size or preload critical components:
```typescript
import { lazy } from 'react'

// Preload on hover
const PaymentModal = lazy(() => import("./payment-modal"))

const preloadPayment = () => {
  import("./payment-modal")
}

<button onMouseEnter={preloadPayment} onClick={openPayment}>
  Pay
</button>
```

---

## Support

For issues during implementation:
1. Check FRONTEND-AUDIT-REPORT.md for detailed explanations
2. Review component backup files
3. Test in isolation (create minimal reproduction)
4. Check browser console for errors

---

**Last Updated:** 2025-12-11
**Version:** 1.0
**Status:** Ready for implementation
