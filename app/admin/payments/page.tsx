"use client"

import { DollarSign } from "lucide-react"

/**
 * Payments Management Page (Placeholder)
 * TODO: Implement payment history, refunds, analytics
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

      {/* Placeholder Content */}
      <div className="rounded-xl border border-border bg-card p-12">
        <div className="text-center space-y-4">
          <DollarSign className="w-16 h-16 text-muted-foreground mx-auto" />
          <h3 className="text-xl font-semibold text-foreground">
            В разработке
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Функционал управления платежами будет добавлен в следующей версии.
            Планируется: история платежей, возвраты, статистика выручки.
          </p>
        </div>
      </div>
    </div>
  )
}
