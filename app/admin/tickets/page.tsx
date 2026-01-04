"use client"

import { Ticket } from "lucide-react"
import { TicketsView } from "@/components/admin/TicketsView"

/**
 * Support Tickets Management Page
 * Lists all support tickets with SLA tracking and messaging
 */
export default function TicketsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Support Tickets
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Управление тикетами поддержки, SLA и переписка с пользователями
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-border">
          <Ticket className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-foreground">Support</span>
        </div>
      </div>

      {/* TicketsView Component */}
      <TicketsView />
    </div>
  )
}
