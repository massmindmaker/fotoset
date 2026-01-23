'use client'

import { formatDistanceToNow, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { EarningsResponse } from '@/lib/partner-types'

interface EarningsTableProps {
  data: EarningsResponse
  page: number
  onPageChange: (page: number) => void
  statusFilter: string
  onStatusChange: (status: string) => void
}

export function EarningsTable({
  data,
  page,
  onPageChange,
  statusFilter,
  onStatusChange
}: EarningsTableProps) {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-600',
    credited: 'bg-green-500/10 text-green-600',
    confirmed: 'bg-green-600/10 text-green-700',
    cancelled: 'bg-red-500/10 text-red-600'
  }

  const statusLabels: Record<string, string> = {
    all: 'All',
    pending: 'Pending',
    credited: 'Credited',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled'
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(statusLabels).map(([value, label]) => (
          <button
            key={value}
            onClick={() => onStatusChange(value)}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              statusFilter === value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-accent'
            }`}
          >
            {label}
            {value !== 'all' && data.summary[value as keyof typeof data.summary] && (
              <span className="ml-1 opacity-70">
                ({data.summary[value as keyof typeof data.summary].count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.earnings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No earnings found
                  </td>
                </tr>
              ) : (
                data.earnings.map((earning) => (
                  <tr key={earning.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {earning.referredUser.username?.[1]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="text-sm font-medium">
                            {earning.referredUser.username || `User #${earning.referredUser.id}`}
                          </div>
                          {earning.payment && (
                            <div className="text-xs text-muted-foreground">
                              Payment: {earning.payment.amount.toLocaleString('ru-RU')} RUB
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-green-500">
                        +{earning.amount.toLocaleString('ru-RU')} {earning.currency}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(earning.commissionRate * 100).toFixed(0)}% commission
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${statusColors[earning.status]}`}>
                        {statusLabels[earning.status]}
                      </span>
                      {earning.cancelledReason && (
                        <div className="text-xs text-red-500 mt-1">
                          {earning.cancelledReason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <div>{format(new Date(earning.createdAt), 'dd MMM yyyy', { locale: ru })}</div>
                      <div className="text-xs">
                        {formatDistanceToNow(new Date(earning.createdAt), {
                          addSuffix: true,
                          locale: ru
                        })}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {page} of {data.pagination.totalPages} ({data.pagination.total} total)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= data.pagination.totalPages}
              className="p-2 rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
