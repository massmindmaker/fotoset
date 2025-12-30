"use client"

import { Sparkles } from "lucide-react"
import { PromptTesterView } from "@/components/admin/PromptTesterView"

/**
 * Prompt Testing Page
 *
 * Day 3: Implemented
 * - Reference image uploader (5-10 photos)
 * - Multiple test blocks with prompts
 * - Photo count selector (1-4)
 * - KIE AI integration with async generation
 * - Results gallery with latency display
 */
export default function PromptTestingPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Prompt Testing
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Тестирование промптов через KIE AI (Nano Banana Pro)
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-border">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-foreground">KIE AI</span>
        </div>
      </div>

      {/* PromptTesterView Component */}
      <PromptTesterView />
    </div>
  )
}
