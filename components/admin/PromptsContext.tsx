'use client'

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'

// Types (shared across all columns)
export interface SavedPrompt {
  id: number
  admin_id: number
  name: string
  prompt: string
  negative_prompt: string | null
  style_id: string | null
  preview_url: string | null
  is_favorite: boolean
  tags: string[] | null
  created_at: string
  updated_at: string
  admin_email: string | null
}

export interface PhotoPack {
  id: number
  admin_id: number
  name: string
  description: string | null
  cover_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  admin_email: string | null
  items_count: number
}

export interface PackItem {
  id: number
  pack_id: number
  photo_url: string
  prompt: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface ReferenceImage {
  id: string
  file: File
  preview: string
}

// Add to Pack Popover target
export interface AddToPackTarget {
  promptId?: number
  imageUrl: string
  prompt?: string
}

interface PromptsContextValue {
  // Reference images (shared for preview generation)
  referenceImages: ReferenceImage[]
  referenceBase64Urls: string[]
  setReferenceImages: (images: ReferenceImage[]) => void
  setReferenceBase64Urls: (urls: string[]) => void

  // Refresh triggers
  refreshSavedPrompts: () => void
  refreshPacks: () => void

  // Register refresh callbacks
  registerPromptsRefresh: (callback: () => void) => void
  registerPacksRefresh: (callback: () => void) => void

  // Add to Pack popover state
  addToPackTarget: AddToPackTarget | null
  openAddToPackPopover: (target: AddToPackTarget) => void
  closeAddToPackPopover: () => void
}

// Export context for optional access (useContext returns null if no provider)
export const PromptsContext = createContext<PromptsContextValue | null>(null)

export function PromptsProvider({ children }: { children: ReactNode }) {
  // Reference images state
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([])
  const [referenceBase64Urls, setReferenceBase64Urls] = useState<string[]>([])

  // Add to Pack popover state
  const [addToPackTarget, setAddToPackTarget] = useState<AddToPackTarget | null>(null)

  // Refresh callback refs (using useRef to avoid memory leaks with useState)
  const promptsRefreshCallbackRef = useRef<(() => void) | null>(null)
  const packsRefreshCallbackRef = useRef<(() => void) | null>(null)

  const registerPromptsRefresh = useCallback((callback: () => void) => {
    promptsRefreshCallbackRef.current = callback
  }, [])

  const registerPacksRefresh = useCallback((callback: () => void) => {
    packsRefreshCallbackRef.current = callback
  }, [])

  const refreshSavedPrompts = useCallback(() => {
    promptsRefreshCallbackRef.current?.()
  }, [])

  const refreshPacks = useCallback(() => {
    packsRefreshCallbackRef.current?.()
  }, [])

  const openAddToPackPopover = useCallback((target: AddToPackTarget) => {
    setAddToPackTarget(target)
  }, [])

  const closeAddToPackPopover = useCallback(() => {
    setAddToPackTarget(null)
  }, [])

  return (
    <PromptsContext.Provider
      value={{
        referenceImages,
        referenceBase64Urls,
        setReferenceImages,
        setReferenceBase64Urls,
        refreshSavedPrompts,
        refreshPacks,
        registerPromptsRefresh,
        registerPacksRefresh,
        addToPackTarget,
        openAddToPackPopover,
        closeAddToPackPopover,
      }}
    >
      {children}
    </PromptsContext.Provider>
  )
}

export function usePromptsContext() {
  const context = useContext(PromptsContext)
  if (!context) {
    throw new Error('usePromptsContext must be used within PromptsProvider')
  }
  return context
}
