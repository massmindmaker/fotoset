"use client"

import { useState, useEffect, useContext } from "react"
import { Plus } from "lucide-react"
import { ReferenceUploader } from "./ReferenceUploader"
import { TestBlock } from "./TestBlock"
import type { ReferenceImage, TestBlock as TestBlockType } from "@/lib/admin/types"
import { PromptsContext } from "./PromptsContext"

/**
 * Hook to safely access PromptsContext without throwing
 * Returns null if context is not available (component used standalone)
 */
function useOptionalPromptsContext() {
  // Direct useContext call - returns null if no provider exists
  return useContext(PromptsContext)
}

/**
 * PromptTesterView Component
 *
 * Main prompt testing interface
 *
 * Features:
 * - Reference image uploader (shared across all blocks)
 * - Multiple test blocks
 * - "Add Test Block" button
 * - Each block generates independently
 * - Shared reference images (synced to Context for preview generation)
 */

export function PromptTesterView() {
  // Safely access context (null if not wrapped in provider)
  const promptsContext = useOptionalPromptsContext()
  const contextAvailable = promptsContext !== null

  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([])
  const [testBlocks, setTestBlocks] = useState<TestBlockType[]>([
    {
      id: "1",
      prompt: "",
      photoCount: 1,
      status: "idle",
    },
  ])

  // Convert reference images to base64 URLs for API
  const [referenceBase64Urls, setReferenceBase64Urls] = useState<string[]>([])

  useEffect(() => {
    // Convert File objects to base64 data URIs
    const convertToBase64 = async () => {
      const urls: string[] = []

      for (const img of referenceImages) {
        try {
          const base64 = await fileToBase64(img.file)
          urls.push(base64)
        } catch (error) {
          console.error("[PromptTesterView] Failed to convert image:", error)
        }
      }

      setReferenceBase64Urls(urls)

      // Sync to context if available
      if (promptsContext) {
        promptsContext.setReferenceBase64Urls(urls)
      }
    }

    if (referenceImages.length > 0) {
      convertToBase64()
    } else {
      setReferenceBase64Urls([])
      if (promptsContext) {
        promptsContext.setReferenceBase64Urls([])
      }
    }

    // Sync reference images to context
    if (promptsContext) {
      promptsContext.setReferenceImages(referenceImages)
    }
  }, [referenceImages, promptsContext])

  const addTestBlock = () => {
    const newBlock: TestBlockType = {
      id: Date.now().toString(),
      prompt: "",
      photoCount: 1,
      status: "idle",
    }
    setTestBlocks([...testBlocks, newBlock])
  }

  const updateTestBlock = (id: string, updates: Partial<TestBlockType>) => {
    setTestBlocks((blocks) =>
      blocks.map((block) =>
        block.id === id ? { ...block, ...updates } : block
      )
    )
  }

  const removeTestBlock = (id: string) => {
    if (testBlocks.length === 1) {
      alert("Должен быть хотя бы один тестовый блок")
      return
    }
    setTestBlocks((blocks) => blocks.filter((block) => block.id !== id))
  }

  // Callback when prompt is saved from TestBlock
  const handlePromptSaved = () => {
    promptsContext?.refreshSavedPrompts()
  }

  // Callback to add image to pack
  const handleAddToPack = (imageUrl: string, prompt?: string) => {
    promptsContext?.openAddToPackPopover({ imageUrl, prompt })
  }

  const isReady = referenceImages.length >= 5

  return (
    <div className="space-y-4 p-4">
      {/* Reference Images Uploader */}
      <ReferenceUploader
        images={referenceImages}
        onImagesChange={setReferenceImages}
        minPhotos={5}
        maxPhotos={10}
      />

      {/* Test Blocks */}
      {isReady && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">
              Тестовые блоки
            </h3>
            <button
              onClick={addTestBlock}
              className="px-3 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Добавить
            </button>
          </div>

          {testBlocks.map((block) => (
            <TestBlock
              key={block.id}
              block={block}
              referenceImages={referenceBase64Urls}
              onUpdate={updateTestBlock}
              onRemove={removeTestBlock}
              isOnlyBlock={testBlocks.length === 1}
              onPromptSaved={handlePromptSaved}
              onAddToPack={contextAvailable ? handleAddToPack : undefined}
            />
          ))}
        </div>
      )}

      {/* Placeholder when no images */}
      {!isReady && referenceImages.length === 0 && (
        <div className="bg-slate-50 rounded-xl p-8 text-center border border-slate-200">
          <div className="max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center mx-auto mb-3">
              <Plus className="w-6 h-6 text-pink-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">
              Загрузите изображения
            </h3>
            <p className="text-sm text-slate-500">
              5-10 референсных фото для тестирования
            </p>
          </div>
        </div>
      )}

      {/* Instruction when images uploaded but < 5 */}
      {!isReady && referenceImages.length > 0 && (
        <div className="bg-pink-50 rounded-xl p-3 border border-pink-200">
          <p className="text-sm text-slate-700 text-center">
            📸 Загрузите ещё {5 - referenceImages.length} фото
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Helper: Convert File to base64 data URI
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
      } else {
        reject(new Error("Failed to convert to base64"))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
