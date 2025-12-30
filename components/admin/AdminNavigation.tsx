"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Activity, Sparkles, Users, DollarSign, Settings, Zap, Gift, MessageSquare } from "lucide-react"

/**
 * Admin Panel Navigation with Active State
 * Client component for dynamic pathname detection
 */
export function AdminNavigation() {
  const pathname = usePathname()

  const navItems = [
    {
      href: "/admin",
      icon: <LayoutDashboard className="w-4 h-4" />,
      label: "Dashboard",
      exact: true,
    },
    {
      href: "/admin/logs",
      icon: <Activity className="w-4 h-4" />,
      label: "Logs",
    },
    {
      href: "/admin/users",
      icon: <Users className="w-4 h-4" />,
      label: "Users",
    },
    {
      href: "/admin/payments",
      icon: <DollarSign className="w-4 h-4" />,
      label: "Payments",
    },
    {
      href: "/admin/generations",
      icon: <Zap className="w-4 h-4" />,
      label: "Generations",
    },
    {
      href: "/admin/prompt-testing",
      icon: <Sparkles className="w-4 h-4" />,
      label: "Prompts",
    },
    {
      href: "/admin/referrals",
      icon: <Gift className="w-4 h-4" />,
      label: "Referrals",
    },
    {
      href: "/admin/telegram",
      icon: <MessageSquare className="w-4 h-4" />,
      label: "Telegram",
    },
    {
      href: "/admin/settings",
      icon: <Settings className="w-4 h-4" />,
      label: "Settings",
    },
  ]

  return (
    <nav className="border-b border-slate-200 bg-white/60 backdrop-blur-sm sticky top-[73px] z-40">
      <div className="container-max px-6">
        <div className="flex gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = 'exact' in item && item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium
                  rounded-t-xl transition-all relative
                  ${
                    isActive
                      ? "text-slate-800 bg-slate-100"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }
                `}
              >
                {item.icon}
                <span>{item.label}</span>
                {/* Active indicator */}
                <span
                  className={`
                    absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500 transition-transform
                    ${isActive ? "scale-x-100" : "scale-x-0"}
                  `}
                />
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
