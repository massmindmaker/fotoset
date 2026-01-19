"use client"

import { ShieldCheck } from "lucide-react"
import { PackModerationView } from "@/components/admin/PackModerationView"

/**
 * Pack Moderation Page
 *
 * Features:
 * - Review pending partner packs
 * - Approve/reject with reasons
 * - View pack prompts before approval
 */
export default function ModerationPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Pack Moderation
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Модерация партнёрских паков
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-medium text-amber-700">Moderation</span>
        </div>
      </div>

      {/* Moderation View Component */}
      <PackModerationView />
    </div>
  )
}
