"use client"

import { useState, useEffect } from "react"
import { Plus } from "lucide-react"
import { ReferenceUploader } from "./ReferenceUploader"
import { TestBlock } from "./TestBlock"
import type { ReferenceImage, TestBlock as TestBlockType } from "@/lib/admin/types"

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
 * - Shared reference images
 */

export function PromptTesterView() {
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
    }

    if (referenceImages.length > 0) {
      convertToBase64()
    } else {
      setReferenceBase64Urls([])
    }
  }, [referenceImages])

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

  const isReady = referenceImages.length >= 5

  return (
    <div className="space-y-6">
      {/* Reference Images Uploader */}
      <ReferenceUploader
        images={referenceImages}
        onImagesChange={setReferenceImages}
        minPhotos={5}
        maxPhotos={10}
      />

      {/* Test Blocks */}
      {isReady && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Тестовые блоки
            </h3>
            <button
              onClick={addTestBlock}
              className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Добавить блок
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
            />
          ))}
        </div>
      )}

      {/* Placeholder when no images */}
      {!isReady && referenceImages.length === 0 && (
        <div className="glass rounded-2xl p-12 text-center border border-border">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Начните с загрузки изображений
            </h3>
            <p className="text-sm text-muted-foreground">
              Загрузите 5-10 референсных фото, чтобы начать тестирование промптов через KIE AI
            </p>
          </div>
        </div>
      )}

      {/* Instruction when images uploaded but < 5 */}
      {!isReady && referenceImages.length > 0 && (
        <div className="glass rounded-xl p-4 border border-primary/20 bg-primary/5">
          <p className="text-sm text-foreground text-center">
            📸 Загрузите ещё {5 - referenceImages.length} фото, чтобы начать тестирование
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
