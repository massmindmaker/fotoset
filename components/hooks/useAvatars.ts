import { useState, useCallback } from "react"
import type { Persona } from "../views/types"
import type { UserIdentifier } from "./useAuth"

/**
 * Custom hook for avatar CRUD operations
 * Handles loading, creating, updating, and deleting avatars
 */
export function useAvatars() {
  const [personas, setPersonas] = useState<Persona[]>([])

  // Load avatars from server
  const loadAvatarsFromServer = useCallback(async (identifier: UserIdentifier): Promise<Persona[]> => {
    try {
      // Use include_photos=true (default) to get all avatars with photos in ONE request
      // Support both Telegram and Web users
      let url: string
      if (identifier.type === 'web' && identifier.neonUserId) {
        url = `/api/avatars?include_photos=true&neon_user_id=${identifier.neonUserId}`
      } else if (identifier.type === 'telegram' && identifier.telegramUserId) {
        url = `/api/avatars?include_photos=true&telegram_user_id=${identifier.telegramUserId}`
      } else {
        console.error("[Avatars] No valid user identifier for loading avatars")
        return []
      }
      const res = await fetch(url)
      if (!res.ok) return []

      const data = await res.json()
      // API returns { success: true, data: { avatars: [...] } }
      const avatars = data.data?.avatars || data.avatars || []
      console.log("[Avatars] API response:", { success: data.success, avatarsCount: avatars.length })
      if (avatars.length === 0) return []

      // Map avatars directly - photos are already included in response
      const loadedPersonas: Persona[] = avatars.map(
        (avatar: {
          id: number
          name: string
          status: string
          thumbnailUrl?: string
          referenceCount?: number
          generatedPhotos?: Array<{
            id: number
            styleId: string
            prompt?: string
            imageUrl: string
            createdAt: string
          }>
        }) => ({
          id: String(avatar.id),
          name: avatar.name,
          status: avatar.status as "draft" | "processing" | "ready",
          images: [],
          generatedAssets: (avatar.generatedPhotos || []).map((photo) => ({
            id: String(photo.id),
            type: "PHOTO" as const,
            url: photo.imageUrl,
            styleId: photo.styleId,
            prompt: photo.prompt,
            createdAt: new Date(photo.createdAt).getTime(),
          })),
          thumbnailUrl: avatar.thumbnailUrl,
          referenceCount: avatar.referenceCount || 0,
        })
      )

      setPersonas(loadedPersonas)
      return loadedPersonas
    } catch (err) {
      console.error("[Init] Failed to load avatars:", err)
      return []
    }
  }, [])

  // Create a new persona with temp ID
  const createPersona = useCallback(() => {
    const tempId = `temp_${Date.now()}`
    const newPersona: Persona = {
      id: tempId,
      name: "Мой аватар",
      status: "draft",
      images: [],
      generatedAssets: [],
    }

    setPersonas((prev) => [...prev, newPersona])
    return tempId
  }, [])

  // Update persona
  const updatePersona = useCallback((id: string, updates: Partial<Persona>) => {
    setPersonas((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))
  }, [])

  // Delete persona - calls API and removes from state
  // Returns { success: boolean, error?: string } for proper error handling
  // Supports both Telegram and Web users
  const deletePersona = useCallback(async (
    id: string,
    telegramUserId?: number,
    neonUserId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    // Skip API for temp IDs (not yet saved to DB)
    if (id.startsWith("temp_")) {
      setPersonas((prev) => prev.filter((p) => p.id !== id))
      return { success: true }
    }

    try {
      let url = `/api/avatars/${id}`
      if (telegramUserId) {
        url += `?telegram_user_id=${telegramUserId}`
      } else if (neonUserId) {
        url += `?neon_user_id=${neonUserId}`
      }

      const res = await fetch(url, { method: "DELETE" })

      if (!res.ok) {
        // Try to extract error message from response
        let errorMsg = "Ошибка удаления"
        try {
          const data = await res.json()
          errorMsg = data.error?.message || data.error?.userMessage || data.message || errorMsg
        } catch {
          // Response not JSON, use status text
          errorMsg = res.status === 403 ? "Нет доступа к этому аватару" : `Ошибка ${res.status}`
        }
        console.error("[Avatars] Delete failed:", res.status, errorMsg)
        return { success: false, error: errorMsg }
      }

      setPersonas((prev) => prev.filter((p) => p.id !== id))
      return { success: true }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Ошибка сети"
      console.error("[Avatars] Delete error:", errorMsg)
      return { success: false, error: errorMsg }
    }
  }, [])

  // Get persona by ID
  const getPersona = useCallback((id: string): Persona | null => {
    return personas.find((p) => p.id === id) || null
  }, [personas])

  return {
    personas,
    setPersonas,
    loadAvatarsFromServer,
    createPersona,
    updatePersona,
    deletePersona,
    getPersona,
  }
}
