'use client'

import { Gift } from 'lucide-react'
import { DiscountsView } from '@/components/admin/DiscountsView'

/**
 * Discounts Page
 *
 * Promo codes management:
 * - Create/edit/delete promo codes
 * - Percentage and fixed amount discounts
 * - Usage tracking
 */
export default function DiscountsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Скидки и промокоды
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Управление промокодами и скидками
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm">
          <Gift className="w-4 h-4 text-purple-600" />
          <span className="text-xs font-medium text-slate-700">Промокоды</span>
        </div>
      </div>

      {/* DiscountsView Component */}
      <DiscountsView />
    </div>
  )
}
