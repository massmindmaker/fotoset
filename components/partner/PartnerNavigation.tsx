'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  BarChart3,
  Wallet,
  Users,
  CreditCard,
  Package,
  Settings,
  ArrowLeft
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { href: '/partner/dashboard', label: 'Dashboard', icon: <BarChart3 className="w-5 h-5" /> },
  { href: '/partner/earnings', label: 'Earnings', icon: <Wallet className="w-5 h-5" /> },
  { href: '/partner/referrals', label: 'Referrals', icon: <Users className="w-5 h-5" /> },
  { href: '/partner/withdrawals', label: 'Withdrawals', icon: <CreditCard className="w-5 h-5" /> },
  { href: '/partner/packs', label: 'My Packs', icon: <Package className="w-5 h-5" /> },
  { href: '/partner/settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
]

export function PartnerNavigation() {
  const pathname = usePathname()

  return (
    <nav className="bg-card border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center h-14 gap-1 overflow-x-auto scrollbar-hide">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>

          <div className="w-px h-6 bg-border mx-2 shrink-0" />

          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors shrink-0",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {item.icon}
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
