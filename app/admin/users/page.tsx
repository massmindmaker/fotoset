"use client"

import { Users } from "lucide-react"
import { UsersView } from "@/components/admin/UsersView"

/**
 * Users Management Page
 * Lists all users with stats and actions
 */
export default function UsersPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            User Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Управление пользователями, Pro статусом и статистикой
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-border">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-foreground">Users</span>
        </div>
      </div>

      {/* UsersView Component */}
      <UsersView />
    </div>
  )
}
