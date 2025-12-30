"use client"

import { DollarSign } from "lucide-react"
import { PaymentsView } from "@/components/admin/PaymentsView"

/**
 * Payments Management Page
 *
 * Features:
 * - Payment history with filters (status, date, tier)
 * - Revenue statistics dashboard
 * - Refund management via T-Bank API
 * - Audit logging for all operations
 */
export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Payment Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            История платежей, возвраты, аналитика
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-border">
          <DollarSign className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-foreground">Payments</span>
        </div>
      </div>

      {/* Payments View Component */}
      <PaymentsView />
    </div>
  )
}
