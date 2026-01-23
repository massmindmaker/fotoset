'use client'

import { useState } from 'react'
import { usePartnerEarnings } from '@/lib/partner-hooks'
import { EarningsTable } from '@/components/partner/EarningsTable'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function PartnerEarningsPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const { data, loading, error } = usePartnerEarnings(page, 20, statusFilter)

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium text-red-500">Error loading earnings</h2>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Link
          href="/partner/dashboard"
          className="inline-block mt-4 text-primary hover:underline"
        >
          Return to dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Earnings History</h1>
        <p className="text-muted-foreground">
          Track all your referral earnings
        </p>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Pending</div>
            <div className="text-xl font-bold text-yellow-500">
              {data.summary.pending.rub.toLocaleString('ru-RU')} RUB
            </div>
            <div className="text-xs text-muted-foreground">
              {data.summary.pending.count} transactions
            </div>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Credited</div>
            <div className="text-xl font-bold text-green-500">
              {data.summary.credited.rub.toLocaleString('ru-RU')} RUB
            </div>
            <div className="text-xs text-muted-foreground">
              {data.summary.credited.count} transactions
            </div>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Confirmed</div>
            <div className="text-xl font-bold text-green-600">
              {data.summary.confirmed.rub.toLocaleString('ru-RU')} RUB
            </div>
            <div className="text-xs text-muted-foreground">
              {data.summary.confirmed.count} transactions
            </div>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Cancelled</div>
            <div className="text-xl font-bold text-red-500">
              {data.summary.cancelled.rub.toLocaleString('ru-RU')} RUB
            </div>
            <div className="text-xs text-muted-foreground">
              {data.summary.cancelled.count} transactions
            </div>
          </div>
        </div>
      )}

      {data && (
        <EarningsTable
          data={data}
          page={page}
          onPageChange={setPage}
          statusFilter={statusFilter}
          onStatusChange={(status) => {
            setStatusFilter(status)
            setPage(1) // Reset page when filter changes
          }}
        />
      )}
    </div>
  )
}
