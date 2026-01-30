"use client"

import { useState, useEffect } from "react"

/**
 * Feature flags returned from /api/settings/features
 */
export interface FeatureFlags {
  stylesEnabled: boolean
}

const DEFAULT_FLAGS: FeatureFlags = {
  stylesEnabled: false,
}

/**
 * Hook to fetch feature flags from the server
 * 
 * Caches the result and returns defaults while loading or on error
 * 
 * @returns Feature flags and loading state
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isCancelled = false

    const fetchFlags = async () => {
      try {
        const response = await fetch('/api/settings/features')
        if (!response.ok) {
          throw new Error('Failed to fetch feature flags')
        }
        const data = await response.json()
        
        if (!isCancelled) {
          setFlags({
            stylesEnabled: data.stylesEnabled ?? false,
          })
        }
      } catch (error) {
        console.error('[useFeatureFlags] Error:', error)
        // Keep defaults on error
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchFlags()

    return () => {
      isCancelled = true
    }
  }, [])

  return {
    ...flags,
    isLoading,
  }
}
