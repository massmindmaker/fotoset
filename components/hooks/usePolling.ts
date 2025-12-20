import { useRef, useEffect, useCallback } from "react"

/**
 * Custom hook for status polling logic
 * Manages multiple polling intervals and timeouts with proper cleanup
 */
export function usePolling() {
  const pollIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Start polling with a unique key
  const startPolling = useCallback((
    key: string,
    callback: () => void | Promise<void>,
    intervalMs: number,
    timeoutMs?: number
  ) => {
    // Clear existing polling for this key
    stopPolling(key)

    // Start interval
    const interval = setInterval(() => {
      Promise.resolve(callback()).catch((err) => {
        console.error(`[Polling:${key}] Error:`, err)
      })
    }, intervalMs)
    pollIntervalsRef.current.set(key, interval)

    // Set safety timeout if provided
    if (timeoutMs) {
      const timeout = setTimeout(() => {
        console.log(`[Polling:${key}] Timeout after ${timeoutMs}ms`)
        stopPolling(key)
      }, timeoutMs)
      timeoutsRef.current.set(key, timeout)
    }

    console.log(`[Polling:${key}] Started (interval: ${intervalMs}ms, timeout: ${timeoutMs || 'none'}ms)`)
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
