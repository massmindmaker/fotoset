"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, Sparkles, Users, DollarSign } from "lucide-react"

/**
 * Admin Panel Navigation with Active State
 * Client component for dynamic pathname detection
 */
export function AdminNavigation() {
  const pathname = usePathname()

  const navItems = [
    {
      href: "/admin/logs",
      icon: <Activity className="w-4 h-4" />,
      label: "Logs & Monitoring",
    },
    {
      href: "/admin/prompt-testing",
      icon: <Sparkles className="w-4 h-4" />,
      label: "Prompt Testing",
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
  ]

  return (
    <nav className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-[73px] z-40">
      <div className="container-max px-6">
        <div className="flex gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium
                  rounded-t-xl transition-all relative
                  ${
                    isActive
                      ? "text-foreground bg-muted/50"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }
                `}
              >
                {item.icon}
                <span>{item.label}</span>
                {/* Active indicator */}
                <span
                  className={`
                    absolute bottom-0 left-0 right-0 h-0.5 bg-primary transition-transform
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
