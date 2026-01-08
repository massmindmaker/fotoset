"use client"

import { Sparkles } from "lucide-react"
import { PromptsAndPacksView } from "@/components/admin/PromptsAndPacksView"

/**
 * Prompts & Packs Page
 *
 * Tabbed interface:
 * - Prompt Tester (KIE AI integration)
 * - Saved Prompts (CRUD)
 * - PhotoPacks (CRUD with items)
 */
export default function PromptTestingPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Промпты и Паки
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Тестирование, сохранённые промпты и фотопаки
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-50 border border-pink-200">
          <Sparkles className="w-4 h-4 text-pink-600" />
          <span className="text-xs font-medium text-pink-700">KIE AI</span>
        </div>
      </div>

      {/* PromptsAndPacksView Component */}
      <PromptsAndPacksView />
    </div>
  )
}
