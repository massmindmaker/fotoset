# usePolling Hook - Quick Reference

## Import

```typescript
import { usePolling } from '@/components/hooks'
// or for non-hook usage
import { createPollingController } from '@/components/hooks/usePolling'
```

---

## Basic Usage

### In React Components (Hook)

```typescript
function MyComponent() {
  const { startPolling, stopPolling } = usePolling()

  useEffect(() => {
    startPolling('my-job', async () => {
      const status = await checkStatus()
      if (status.done) {
        stopPolling('my-job')
      }
    }, { intervalMs: 2000 })
  }, [])
}
```

### In useEffect or Non-Hook Context

```typescript
useEffect(() => {
  const controller = createPollingController()

  controller.start('status', callback, { intervalMs: 1000 })

  return () => controller.stopAll()
}, [])
```

---

## API Reference

### PollingOptions

```typescript
interface PollingOptions {
  intervalMs: number      // Required: polling interval
  timeoutMs?: number      // Optional: max time before stopping
  maxAttempts?: number    // Optional: max attempts before stopping
  onTimeout?: () => void  // Optional: called when timeout/max attempts reached
  onError?: (err) => void // Optional: called on each error
}
```

### usePolling Methods

```typescript
const { startPolling, stopPolling, stopAllPolling } = usePolling()

// Start polling
startPolling(key: string, callback: () => void | Promise<void>, options: PollingOptions)

// Stop specific polling
stopPolling(key: string)

// Stop all polling (called automatically on unmount)
stopAllPolling()
```

---

## Common Patterns

### 1. Poll Until Success

```typescript
startPolling('payment-check', async () => {
  const res = await fetch('/api/payment/status')
  const data = await res.json()

  if (data.paid) {
    stopPolling('payment-check')
    onPaymentSuccess()
  }
}, { intervalMs: 2000, timeoutMs: 60000 })
```

### 2. Poll with Max Attempts

```typescript
startPolling('status-check', async () => {
  const status = await checkStatus()
  if (status === 'complete') {
    stopPolling('status-check')
  }
}, {
  intervalMs: 3000,
  maxAttempts: 20,
  onTimeout: () => alert('Timed out after 20 attempts')
})
```

### 3. Poll with Error Handling

```typescript
startPolling('api-health', async () => {
  const health = await fetch('/api/health')
  if (!health.ok) throw new Error('API unhealthy')
}, {
  intervalMs: 5000,
  onError: (err) => console.error('Health check failed:', err)
})
```

### 4. Poll Generation Job Progress

```typescript
const { startPolling, stopPolling } = usePolling()

const pollGenerationStatus = (jobId: string) => {
  startPolling(`generation-${jobId}`, async () => {
    const res = await fetch(`/api/generate?job_id=${jobId}`)
    const data = await res.json()

    setProgress(data.progress)

    if (data.status === 'completed' || data.status === 'failed') {
      stopPolling(`generation-${jobId}`)
      setIsGenerating(false)

      if (data.status === 'failed') {
        alert(data.error || 'Generation failed')
      }
    }
  }, {
    intervalMs: 3000,
    timeoutMs: 15 * 60 * 1000, // 15 minutes
  })
}
```

### 5. Non-Hook Usage (in useEffect)

```typescript
useEffect(() => {
  const controller = createPollingController()

  controller.start('payment-status', async () => {
    const res = await checkPayment()
    if (res.paid) {
      controller.stop('payment-status')
      setStatus('success')
    }
  }, {
    intervalMs: 1000,
    maxAttempts: 60,
    onTimeout: () => setStatus('timeout')
  })

  return () => controller.stopAll()
}, [telegramUserId])
```

---

## Real-World Examples (from codebase)

### Payment Status Polling

```typescript
// app/payment/callback/page.tsx
const controller = createPollingController()

controller.start('payment-status', async () => {
  const res = await fetch(`/api/payment/status?telegram_user_id=${userId}`)
  const data = await res.json()

  if (data.paid) {
    controller.stop('payment-status')
    setStatus("success")
    router.push("/?resume_payment=true")
  }
}, {
  intervalMs: isTestMode ? 1000 : 2000,
  maxAttempts: isTestMode ? 30 : 30,
  onTimeout: () => setStatus("timeout")
})
```

### Generation Job Polling

```typescript
// components/persona-app.tsx
startPolling(`generate-${jobId}`, async () => {
  const statusRes = await fetch(`/api/generate?job_id=${jobId}`)
  const statusData = await statusRes.json()

  setGenerationProgress({
    completed: statusData.progress?.completed || 0,
    total: statusData.progress?.total || tier.photos,
  })

  if (statusData.photos && statusData.photos.length > lastPhotoCount) {
    // Update UI with new photos
    updatePersonaPhotos(statusData.photos.slice(lastPhotoCount))
    lastPhotoCount = statusData.photos.length
  }

  if (statusData.status === "completed" || statusData.status === "failed") {
    stopPolling(`generate-${jobId}`)
    setIsGenerating(false)
  }
}, {
  intervalMs: 3000,
  timeoutMs: 15 * 60 * 1000
})
```

---

## Best Practices

### 1. Always Use Unique Keys
```typescript
// Good
startPolling(`job-${jobId}`, callback, options)
startPolling(`payment-${userId}`, callback, options)

// Bad (collision risk)
startPolling('status', callback, options)
```

### 2. Stop Polling When Done
```typescript
// Good
if (data.complete) {
  stopPolling(key)
  handleCompletion()
}

// Bad (keeps polling unnecessarily)
if (data.complete) {
  handleCompletion()
}
```

### 3. Set Reasonable Timeouts
```typescript
// Good (prevents infinite polling)
{ intervalMs: 2000, timeoutMs: 60000 } // 30 attempts max

// Bad (could poll forever)
{ intervalMs: 2000 }
```

### 4. Handle Errors Gracefully
```typescript
// Good
startPolling(key, async () => {
  try {
    const data = await fetchData()
    if (data.done) stopPolling(key)
  } catch (err) {
    // Let hook's error handler log it
    throw err
  }
}, {
  intervalMs: 2000,
  onError: (err) => Sentry.captureException(err)
})
```

### 5. Clean Up in useEffect
```typescript
// Good (automatic cleanup)
useEffect(() => {
  const controller = createPollingController()
  controller.start(key, callback, options)
  return () => controller.stopAll()
}, [])

// Bad (memory leak)
useEffect(() => {
  const controller = createPollingController()
  controller.start(key, callback, options)
  // Missing cleanup!
}, [])
```

---

## Debugging

All polling operations log to console with `[Polling:key]` prefix:

```
[Polling:payment-status] Started (interval: 2000ms, timeout: 60000ms, maxAttempts: none)
[Polling:payment-status] Stopped interval
[Polling:payment-status] Cleared timeout
[Polling:payment-status] Max attempts reached: 30
```

Enable debug logging:
```typescript
// In browser console
localStorage.debug = 'polling:*'
```

---

## Migration from Old Pattern

### Before (Manual Polling)

```typescript
const attemptsRef = useRef(0)

const checkStatus = async () => {
  if (attemptsRef.current >= 30) {
    setStatus('timeout')
    return
  }
  attemptsRef.current++

  const res = await fetch('/api/status')
  const data = await res.json()

  if (data.done) {
    setStatus('success')
  } else {
    setTimeout(checkStatus, 2000)
  }
}

useEffect(() => {
  checkStatus()
}, [])
```

### After (Using usePolling)

```typescript
const { startPolling, stopPolling } = usePolling()

useEffect(() => {
  startPolling('status-check', async () => {
    const res = await fetch('/api/status')
    const data = await res.json()

    if (data.done) {
      stopPolling('status-check')
      setStatus('success')
    }
  }, {
    intervalMs: 2000,
    maxAttempts: 30,
    onTimeout: () => setStatus('timeout')
  })
}, [])
```

---

## TypeScript Tips

### Type Your Callbacks

```typescript
startPolling('job', async () => {
  const res = await fetch<JobStatus>('/api/job')
  const data: JobStatus = await res.json()

  if (data.status === 'complete') {
    stopPolling('job')
  }
}, { intervalMs: 2000 })
```

### Type Your Options

```typescript
const pollingOptions: PollingOptions = {
  intervalMs: 3000,
  timeoutMs: 60000,
  onTimeout: () => console.log('Timed out'),
  onError: (err: unknown) => handleError(err),
}

startPolling('my-job', callback, pollingOptions)
```

---

## Performance Considerations

- **Interval Choice**: 1-3 seconds is typical (avoid sub-second for server load)
- **Cleanup**: Always stop polling when done to prevent unnecessary requests
- **Timeout**: Set reasonable limits to prevent infinite polling
- **Error Handling**: Don't retry indefinitely on errors
- **Network Efficiency**: Consider exponential backoff for failed requests (future enhancement)

---

## Common Issues

### Issue: Polling Doesn't Stop
**Solution:** Ensure you call `stopPolling(key)` when condition is met

### Issue: Memory Leak
**Solution:** Use cleanup in useEffect: `return () => controller.stopAll()`

### Issue: Polling Too Fast
**Solution:** Increase `intervalMs` (2000-5000ms is typical)

### Issue: Timeout Too Short
**Solution:** Calculate: `maxAttempts * intervalMs` should be > expected completion time

---

## See Also

- [Polling Consolidation](C:\Users\bob\Projects\Fotoset\docs\polling-consolidation.md)
- [Polling Refactor Summary](C:\Users\bob\Projects\Fotoset\docs\polling-refactor-summary.md)
- [Custom Hooks Reference](C:\Users\bob\Projects\Fotoset\docs\hooks-quick-reference.md)
