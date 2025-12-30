"use client"

import { CommandPalette } from "./CommandPalette"
import { NotificationBell } from "./NotificationBell"

/**
 * AdminClientProviders
 *
 * Client-side providers and global components for admin panel
 * This wraps client components that need to be used in the server layout
 */
export function AdminClientProviders({
  children,
  showNotifications = false
}: {
  children: React.ReactNode
  showNotifications?: boolean
}) {
  return (
    <>
      {children}
      <CommandPalette />
    </>
  )
}

/**
 * Export NotificationBell for use in header
 */
export { NotificationBell }
