import { useState, useEffect, useCallback } from "react"

export interface NetworkStatus {
  isOnline: boolean
  isSlowConnection: boolean
  connectionType: string | null
}

/**
 * Custom hook for detecting network status changes
 * Provides offline detection, slow connection detection, and retry utilities
 */
export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isSlowConnection: false,
    connectionType: null,
  })

  // Check connection quality
  const checkConnectionQuality = useCallback(() => {
    if (typeof navigator === "undefined") return

    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection

    if (connection) {
      const slowTypes = ["slow-2g", "2g"]
      const isSlowConnection = slowTypes.includes(connection.effectiveType || "") ||
        (connection.downlink !== undefined && connection.downlink < 1)

      setStatus(prev => ({
        ...prev,
        isSlowConnection,
        connectionType: connection.effectiveType || null,
      }))
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }))
      checkConnectionQuality()
    }

    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }))
    }

    // Initial check
    checkConnectionQuality()

    // Listen for network changes
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Listen for connection quality changes
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
    if (connection) {
      connection.addEventListener("change", checkConnectionQuality)
    }

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      if (connection) {
        connection.removeEventListener("change", checkConnectionQuality)
      }
    }
  }, [checkConnectionQuality])

  return status
}

/**
 * Retry utility with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    onRetry?: (attempt: number, error: Error) => void
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    onRetry
  } = options

  let lastError: Error = new Error("Unknown error")

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === maxRetries) {
        throw lastError
      }

      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay)
      onRetry?.(attempt + 1, lastError)

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

// Network Information API types
interface NetworkInformation extends EventTarget {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g"
  downlink?: number
  rtt?: number
  saveData?: boolean
}
