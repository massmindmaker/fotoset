import { useState, useCallback } from "react"
import type { Persona } from "../views/types"
import { extractErrorMessage } from "@/lib/error-utils"

/**
 * Custom hook for syncing persona data to server
 * Handles avatar creation and reference photo uploads
 */
export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false)

  // Helper: convert File to base64
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = ev.target?.result as string
        if (result) {
          resolve(result)
        } else {
          reject(new Error("Empty file"))
        }
      }
      reader.onerror = () => reject(reader.error || new Error("Read failed"))
      reader.readAsDataURL(file)
    })
  }, [])

  // Sync persona to server: create avatar in DB and upload photos
  // Returns the DB avatar ID (numeric string like "123")
  const syncPersonaToServer = useCallback(async (
    persona: Persona,
    telegramUserId: number | undefined
  ): Promise<string> => {
    // Check if already has DB ID (not a temp ID like "temp_123456")
    const parsedId = parseInt(persona.id)
    const isDbId = !isNaN(parsedId) && parsedId > 0 && parsedId <= 2147483647

    // ROBUST: Try multiple sources for telegram user ID
    let tg = window.Telegram?.WebApp
    let tgUserFromWebApp = tg?.initDataUnsafe?.user?.id

    // Fallback: if SDK not ready yet, wait
    if (!tgUserFromWebApp && !telegramUserId) {
      console.log("[Sync] Waiting for Telegram SDK...")
      await new Promise<void>((resolve) => {
        let attempts = 0
        const interval = setInterval(() => {
          attempts++
          const check = window.Telegram?.WebApp?.initDataUnsafe?.user?.id
          if (check || attempts >= 30) { // 3 seconds max
            clearInterval(interval)
            resolve()
          }
        }, 100)
      })
      tg = window.Telegram?.WebApp
      tgUserFromWebApp = tg?.initDataUnsafe?.user?.id
      console.log("[Sync] After wait - SDK ready:", !!tgUserFromWebApp)
    }

    const tgId = tgUserFromWebApp || telegramUserId

    console.log("[Sync] Telegram ID sources:", {
      fromWebApp: tgUserFromWebApp,
      fromState: telegramUserId,
      hasTg: !!tg,
      hasInitDataUnsafe: !!tg?.initDataUnsafe,
      hasUser: !!tg?.initDataUnsafe?.user,
      final: tgId,
    })

    if (!tgId) {
      console.error("[Sync] No telegram user ID available from any source!")
      const errorMsg = "Ошибка: не удалось получить Telegram ID. Закройте и откройте приложение заново через @Pinglass_bot"
      if (tg?.showAlert) {
        try {
          tg.showAlert(errorMsg)
        } catch {
          alert(errorMsg)
        }
      } else {
        alert(errorMsg)
      }
      throw new Error("Telegram user ID not available")
    }

    try {
      let dbAvatarId: string

      // Step 1: Create avatar in DB OR use existing ID
      if (isDbId) {
        dbAvatarId = persona.id
        console.log("[Sync] Using existing DB avatar ID:", dbAvatarId)
      } else {
        const createRes = await fetch("/api/avatars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telegramUserId: tgId,
            name: persona.name || "Мой аватар",
          }),
        })

        if (!createRes.ok) {
          const err = await createRes.json()
          throw new Error(extractErrorMessage(err, "Failed to create avatar"))
        }

        const avatarData = await createRes.json()
        dbAvatarId = String(avatarData.data.id)
        console.log("[Sync] Avatar created with DB ID:", dbAvatarId)
      }

      // Step 2: Upload reference photos to R2 (PARALLEL for speed)
      if (persona.images && persona.images.length > 0) {
        console.log("[Sync] Uploading", persona.images.length, "reference photos to R2 (parallel)")

        const imagesToUpload = persona.images.slice(0, 14)

        // Parallel upload with Promise.allSettled
        const uploadPromises = imagesToUpload.map(async (img, i) => {
          try {
            console.log(`[Sync] Starting upload ${i + 1}/${imagesToUpload.length}`)
            const base64Data = await fileToBase64(img.file)

            const uploadRes = await fetch("/api/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                avatarId: dbAvatarId,
                type: "reference",
                image: base64Data,
              }),
            })

            if (uploadRes.ok) {
              const result = await uploadRes.json()
              if (result.data?.url) {
                console.log(`[Sync] Photo ${i + 1} uploaded to R2:`, result.data.key)
                return { success: true, index: i, url: result.data.url }
              }
            }
            const errText = await uploadRes.text()
            console.error(`[Sync] Photo ${i + 1} FAILED:`, uploadRes.status, errText)
            return { success: false, index: i, error: errText }
          } catch (err) {
            console.error(`[Sync] Error uploading photo ${i + 1}:`, err)
            return { success: false, index: i, error: String(err) }
          }
        })

        const results = await Promise.allSettled(uploadPromises)
        const uploadedUrls: string[] = []

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.success && result.value.url) {
            uploadedUrls.push(result.value.url)
          }
        }

        console.log(`[Sync] Uploaded ${uploadedUrls.length}/${imagesToUpload.length} photos to R2`)

        // Save R2 URLs to database
        if (uploadedUrls.length > 0) {
          try {
            const saveRes = await fetch(`/api/avatars/${dbAvatarId}/references`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                telegramUserId: tgId,
                referenceImages: uploadedUrls,
              }),
            })

            if (saveRes.ok) {
              const saveResult = await saveRes.json()
              console.log("[Sync] Reference URLs saved to DB:", saveResult.uploadedCount)
            } else {
              console.error("[Sync] Failed to save reference URLs to DB")
            }
          } catch (err) {
            console.error("[Sync] Error saving reference URLs:", err)
          }
        }

        // FALLBACK: If R2 upload failed, try saving base64 directly to DB
        if (uploadedUrls.length === 0) {
          console.warn("[Sync] R2 upload failed for all photos, trying direct DB fallback...")

          // Notify user about fallback (slower path)
          const tg = window.Telegram?.WebApp
          const fallbackMessage = "Используем альтернативный способ загрузки..."
          if (tg?.showAlert) {
            try {
              tg.showAlert(fallbackMessage)
            } catch {
              // Silent fallback
            }
          }

          const fallbackImages = imagesToUpload.slice(0, 5)
          const base64Images: string[] = []

          for (const img of fallbackImages) {
            try {
              const b64 = await fileToBase64(img.file)
              base64Images.push(b64)
            } catch (err) {
              console.error("[Sync] Fallback: failed to convert image:", err)
            }
          }

          if (base64Images.length > 0) {
            try {
              const fallbackRes = await fetch(`/api/avatars/${dbAvatarId}/references`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  telegramUserId: tgId,
                  referenceImages: base64Images,
                }),
              })

              if (fallbackRes.ok) {
                const result = await fallbackRes.json()
                if (result.uploadedCount > 0) {
                  console.log("[Sync] Fallback succeeded:", result.uploadedCount, "photos saved to DB")
                } else {
                  throw new Error("Не удалось сохранить фото в БД")
                }
              } else {
                const errText = await fallbackRes.text()
                console.error("[Sync] Fallback failed:", errText)
                throw new Error("Ошибка сохранения фото в БД")
              }
            } catch (err) {
              console.error("[Sync] Fallback error:", err)
              throw new Error("Не удалось загрузить фото ни в R2, ни в БД")
            }
          } else {
            throw new Error("Не удалось обработать фото для сохранения")
          }
        }
      }

      return dbAvatarId
    } catch (error) {
      console.error("[Sync] Error syncing persona:", error)
      throw error
    }
  }, [fileToBase64])

  return {
    isSyncing,
    setIsSyncing,
    syncPersonaToServer,
  }
}
