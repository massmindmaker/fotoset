"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Activity, Sparkles, Users, DollarSign, Settings, Zap, Gift, MessageSquare, Menu, X } from "lucide-react"

/**
 * Admin Panel Navigation with Active State
 * Client component for dynamic pathname detection
 * Mobile responsive with hamburger menu
 */
export function AdminNavigation() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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

  // Find active item for mobile display
  const activeItem = navItems.find(item => {
    if ('exact' in item && item.exact) {
      return pathname === item.href
    }
    return pathname.startsWith(item.href)
  })

  return (
    <nav className="border-b border-slate-200 bg-white/60 backdrop-blur-sm sticky top-[73px] z-40">
      <div className="container-max px-4 md:px-6">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between py-2">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            <span className="font-medium text-sm">{activeItem?.label || 'Menu'}</span>
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute left-0 right-0 bg-white border-b border-slate-200 shadow-lg z-50">
            <div className="p-2 grid grid-cols-2 gap-1">
              {navItems.map((item) => {
                const isActive = 'exact' in item && item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-2 px-3 py-2.5 text-sm font-medium
                      rounded-lg transition-all
                      ${
                        isActive
                          ? "text-slate-800 bg-blue-50"
                          : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                      }
                    `}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Desktop Navigation */}
        <div className="hidden md:flex gap-1 overflow-x-auto">
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
