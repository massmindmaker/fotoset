import { useRef, useEffect, useCallback } from "react"

interface PollingOptions {
  /** Polling interval in milliseconds */
  intervalMs: number
  /** Maximum time to poll before timing out */
  timeoutMs?: number
  /** Maximum number of attempts before stopping (alternative to timeout) */
  maxAttempts?: number
  /** Called when polling times out */
  onTimeout?: () => void
  /** Called on each polling error */
  onError?: (error: unknown) => void
}

/**
 * Custom hook for status polling logic
 * Manages multiple polling intervals and timeouts with proper cleanup
 *
 * Usage:
 * ```ts
 * const { startPolling, stopPolling } = usePolling()
 *
 * // Simple polling with interval
 * startPolling('payment-status', async () => {
 *   const res = await checkStatus()
 *   if (res.complete) stopPolling('payment-status')
 * }, { intervalMs: 2000 })
 *
 * // Polling with max attempts
 * startPolling('generation', callback, {
 *   intervalMs: 3000,
 *   maxAttempts: 30,
 *   onTimeout: () => console.log('Generation timed out')
 * })
 * ```
 */
export function usePolling() {
  const pollIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const attemptsRef = useRef<Map<string, number>>(new Map())

  // Start polling with a unique key
  const startPolling = useCallback((
    key: string,
    callback: () => void | Promise<void>,
    options: PollingOptions
  ) => {
    const { intervalMs, timeoutMs, maxAttempts, onTimeout, onError } = options

    // Clear existing polling for this key
    stopPolling(key)
    attemptsRef.current.set(key, 0)

    const executeCallback = async () => {
      try {
        // Check max attempts
        if (maxAttempts) {
          const attempts = (attemptsRef.current.get(key) || 0) + 1
          attemptsRef.current.set(key, attempts)

          if (attempts > maxAttempts) {
            console.log(`[Polling:${key}] Max attempts reached: ${attempts}`)
            stopPolling(key)
            onTimeout?.()
            return
          }
        }

        await Promise.resolve(callback())
      } catch (err) {
        console.error(`[Polling:${key}] Error:`, err)
        onError?.(err)
      }
    }

    // Execute immediately first time
    executeCallback()

    // Start interval
    const interval = setInterval(executeCallback, intervalMs)
    pollIntervalsRef.current.set(key, interval)

    // Set safety timeout if provided
    if (timeoutMs) {
      const timeout = setTimeout(() => {
        console.log(`[Polling:${key}] Timeout after ${timeoutMs}ms`)
        stopPolling(key)
        onTimeout?.()
      }, timeoutMs)
      timeoutsRef.current.set(key, timeout)
    }

    console.log(`[Polling:${key}] Started (interval: ${intervalMs}ms, timeout: ${timeoutMs || 'none'}ms, maxAttempts: ${maxAttempts || 'none'})`)
  }, [])

  // Stop polling for a specific key
  const stopPolling = useCallback((key: string) => {
    const interval = pollIntervalsRef.current.get(key)
    if (interval) {
      clearInterval(interval)
      pollIntervalsRef.current.delete(key)
      console.log(`[Polling:${key}] Stopped interval`)
    }

    const timeout = timeoutsRef.current.get(key)
    if (timeout) {
      clearTimeout(timeout)
      timeoutsRef.current.delete(key)
      console.log(`[Polling:${key}] Cleared timeout`)
    }

    attemptsRef.current.delete(key)
  }, [])

  // Stop all polling
  const stopAllPolling = useCallback(() => {
    pollIntervalsRef.current.forEach((interval, key) => {
      clearInterval(interval)
      console.log(`[Polling:${key}] Cleared interval on cleanup`)
    })
    pollIntervalsRef.current.clear()

    timeoutsRef.current.forEach((timeout, key) => {
      clearTimeout(timeout)
      console.log(`[Polling:${key}] Cleared timeout on cleanup`)
    })
    timeoutsRef.current.clear()

    attemptsRef.current.clear()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllPolling()
    }
  }, [stopAllPolling])

  return {
    startPolling,
    stopPolling,
    stopAllPolling,
  }
}

/**
 * Standalone polling utility for use in components (non-hook version)
 * Use this in components that can't use hooks (e.g., inside useEffect with complex deps)
 */
export function createPollingController() {
  const intervals = new Map<string, NodeJS.Timeout>()
  const timeouts = new Map<string, NodeJS.Timeout>()
  const attempts = new Map<string, number>()

  return {
    start(key: string, callback: () => void | Promise<void>, options: PollingOptions) {
      const { intervalMs, timeoutMs, maxAttempts, onTimeout, onError } = options

      // Clear existing
      this.stop(key)
      attempts.set(key, 0)

      const executeCallback = async () => {
        try {
          if (maxAttempts) {
            const count = (attempts.get(key) || 0) + 1
            attempts.set(key, count)

            if (count > maxAttempts) {
              this.stop(key)
              onTimeout?.()
              return
            }
          }

          await Promise.resolve(callback())
        } catch (err) {
          console.error(`[Polling:${key}] Error:`, err)
          onError?.(err)
        }
      }

      executeCallback()
      const interval = setInterval(executeCallback, intervalMs)
      intervals.set(key, interval)

      if (timeoutMs) {
        const timeout = setTimeout(() => {
          this.stop(key)
          onTimeout?.()
        }, timeoutMs)
        timeouts.set(key, timeout)
      }
    },

    stop(key: string) {
      const interval = intervals.get(key)
      if (interval) {
        clearInterval(interval)
        intervals.delete(key)
      }

      const timeout = timeouts.get(key)
      if (timeout) {
        clearTimeout(timeout)
        timeouts.delete(key)
      }

      attempts.delete(key)
    },

    stopAll() {
      intervals.forEach(clearInterval)
      intervals.clear()
      timeouts.forEach(clearTimeout)
      timeouts.clear()
      attempts.clear()
    },
  }
}
