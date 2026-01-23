'use client'

import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Earning } from '@/lib/partner-types'

interface RecentEarningsProps {
  earnings: Earning[]
}

export function RecentEarnings({ earnings }: RecentEarningsProps) {
  const statusColors: Record<string, string> = {
    pending: 'text-yellow-500',
    credited: 'text-green-500',
    confirmed: 'text-green-600',
    cancelled: 'text-red-500'
  }

  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    credited: 'Credited',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled'
  }

  if (earnings.length === 0) {
    return (
      <div className="bg-card border rounded-lg p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          Recent Earnings
        </h3>
        <div className="text-center text-muted-foreground py-8">
          No earnings yet
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border rounded-lg p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">
        Recent Earnings
      </h3>

      <div className="space-y-3">
        {earnings.slice(0, 5).map((earning) => (
          <div
            key={earning.id}
            className="flex items-center justify-between py-2 border-b last:border-0"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                {earning.referredUser.username?.[1]?.toUpperCase() || '?'}
              </div>
              <div>
                <div className="text-sm font-medium">
                  {earning.referredUser.username || `User #${earning.referredUser.id}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(earning.createdAt), {
                    addSuffix: true,
                    locale: ru
                  })}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-green-500">
                +{earning.amount.toLocaleString('ru-RU')} {earning.currency}
              </div>
              <div className={`text-xs ${statusColors[earning.status]}`}>
                {statusLabels[earning.status]}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
