"use client"

import { Users } from "lucide-react"
import { PartnersView } from "@/components/admin/PartnersView"

/**
 * Partners Management Page
 *
 * Features:
 * - Partner program statistics
 * - Partner applications management
 * - Commission tracking
 * - Performance analytics
 */
export default function PartnersPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Partner Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Партнерская программа, заявки, комиссии
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-50 border border-pink-200">
          <Users className="w-4 h-4 text-pink-600" />
          <span className="text-xs font-medium text-pink-700">Partners</span>
        </div>
      </div>

      {/* Partners View Component */}
      <PartnersView />
    </div>
  )
}
