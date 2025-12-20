import { useState, useCallback, useRef } from "react"
import type { Persona, PricingTier, GeneratedAsset } from "../views/types"

interface GenerationProgress {
  completed: number
  total: number
}

/**
 * Custom hook for AI photo generation state and logic
 * Handles generation process, progress tracking, and status updates
 */
export function useGeneration() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>({
    completed: 0,
    total: 0
  })

  // Helper: convert File to base64
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = ev.target?.result as string
        if (result) {
          // Keep full data URL with prefix (e.g., "data:image/jpeg;base64,...")
          resolve(result)
        } else {
          reject(new Error("Empty file"))
        }
      }
      reader.onerror = () => reject(reader.error || new Error("Read failed"))
      reader.readAsDataURL(file)
    })
  }, [])

  return {
    isGenerating,
    setIsGenerating,
    generationProgress,
    setGenerationProgress,
    fileToBase64,
  }
}
