import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { Shield } from "lucide-react"
import { AdminNavigation } from "@/components/admin/AdminNavigation"
import { AdminClientProviders } from "@/components/admin/AdminClientProviders"
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions"
// AdminModeIndicator removed - no longer needed in UI
import { getCurrentSession } from "@/lib/admin/session"
import { getRoleDisplayName } from "@/lib/admin/permissions"

/**
 * Admin Panel Layout
 *
 * Features:
 * - Server-side session authentication
 * - Email/Google OAuth based auth
 * - Role display
 * - Logout button
 */

interface AdminLayoutProps {
  children: React.ReactNode
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // Server-side session check
  const session = await getCurrentSession()

  // Allow login page without auth
  // Check is done in page components

  return (
    <AdminClientProviders>
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container-max px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo + Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-pink-600" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-800">
                  PinGlass Admin Panel
                </h1>
                <p className="text-xs text-slate-500">
                  Управление и мониторинг
                </p>
              </div>
            </div>

            {/* User Info + Actions */}
            {session && (
              <AdminHeaderActions
                session={{
                  firstName: session.firstName,
                  email: session.email,
                  role: session.role,
                  avatarUrl: session.avatarUrl
                }}
                roleDisplayName={getRoleDisplayName(session.role as 'super_admin' | 'admin' | 'viewer')}
              />
            )}
          </div>
        </div>
      </header>

      {/* Tab Navigation - only show if authenticated */}
      {session && <AdminNavigation />}

      {/* Main Content */}
      <main className="container-max px-6 py-8">
        {children}
      </main>
    </div>
    </AdminClientProviders>
  )
}
