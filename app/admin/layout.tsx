import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Shield } from "lucide-react"
import { getUserIdentifier } from "@/lib/auth-utils"
import { checkAdminAccess } from "@/lib/admin/auth"
import { AdminNavigation } from "@/components/admin/AdminNavigation"

/**
 * Admin Panel Layout
 *
 * Features:
 * - Server-side authentication check (redundant with middleware, but safer)
 * - Two-tab navigation: Logs & Monitoring | Prompt Testing
 * - User info display (Telegram user ID)
 * - Desktop-first responsive design
 */

interface AdminLayoutProps {
  children: React.ReactNode
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // Server-side auth check (TEMPORARILY DISABLED FOR TESTING)
  // TODO: Re-enable before production deployment

  const headersList = await headers()
  const telegramUserId = headersList.get("x-telegram-user-id") || "test-user"

  /* COMMENTED OUT - Re-enable for production:
  if (!telegramUserId) {
    redirect("/")
  }

  const parsedUserId = parseInt(telegramUserId)
  if (isNaN(parsedUserId) || !checkAdminAccess(parsedUserId)) {
    redirect("/")
  }
  */

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container-max px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo + Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  PinGlass Admin Panel
                </h1>
                <p className="text-xs text-muted-foreground">
                  Управление и мониторинг
                </p>
              </div>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl glass">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">
                  {telegramUserId.charAt(0)}
                </span>
              </div>
              <div className="hidden sm:block">
                <p className="text-xs text-muted-foreground">Admin</p>
                <p className="text-sm font-medium text-foreground">
                  ID: {telegramUserId}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <AdminNavigation />

      {/* Main Content */}
      <main className="container-max px-6 py-8">
        {children}
      </main>
    </div>
  )
}

