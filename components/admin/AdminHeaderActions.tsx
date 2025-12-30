"use client"

import { LogOut } from "lucide-react"
import { NotificationBell } from "./NotificationBell"

interface AdminHeaderActionsProps {
  session: {
    firstName?: string
    email: string
    role: string
    avatarUrl?: string
  }
  roleDisplayName: string
}

/**
 * AdminHeaderActions - Client component for header actions
 * Contains notification bell and logout button
 */
export function AdminHeaderActions({ session, roleDisplayName }: AdminHeaderActionsProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Notification Bell */}
      <NotificationBell />

      {/* User Info */}
      <div className="flex items-center gap-3 px-4 py-2 rounded-xl glass">
        {session.avatarUrl ? (
          <img
            src={session.avatarUrl}
            alt=""
            className="w-8 h-8 rounded-lg object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {(session.firstName || session.email).charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="hidden sm:block">
          <p className="text-xs text-muted-foreground">
            {roleDisplayName}
          </p>
          <p className="text-sm font-medium text-foreground">
            {session.firstName || session.email.split('@')[0]}
          </p>
        </div>
      </div>

      {/* Logout Button */}
      <form action="/api/admin/auth/logout" method="POST">
        <button
          type="submit"
          className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Выйти"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </form>
    </div>
  )
}
