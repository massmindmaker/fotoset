'use client'

import { formatDistanceToNow, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReferralsResponse } from '@/lib/partner-types'

interface ReferralsTableProps {
  data: ReferralsResponse
  page: number
  onPageChange: (page: number) => void
}

export function ReferralsTable({
  data,
  page,
  onPageChange
}: ReferralsTableProps) {
  return (
    <div className="space-y-4">
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
                  Registered
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Payments
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Your Earnings
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Last Active
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.referrals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No referrals yet. Share your referral link to start earning!
                  </td>
                </tr>
              ) : (
                data.referrals.map((referral) => (
                  <tr key={referral.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {referral.username?.[1]?.toUpperCase() || '?'}
                        </div>
                        <div className="text-sm font-medium">
                          {referral.username || `User #${referral.id}`}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <div>{format(new Date(referral.registeredAt), 'dd MMM yyyy', { locale: ru })}</div>
                      <div className="text-xs">
                        {formatDistanceToNow(new Date(referral.registeredAt), {
                          addSuffix: true,
                          locale: ru
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">
                        {referral.totalPayments}
                      </div>
                      {referral.totalSpent > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {referral.totalSpent.toLocaleString('ru-RU')} RUB
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-sm font-medium ${referral.totalEarned > 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {referral.totalEarned > 0
                          ? `+${referral.totalEarned.toLocaleString('ru-RU')} RUB`
                          : '0 RUB'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {referral.lastActivityAt ? (
                        <>
                          <div>{format(new Date(referral.lastActivityAt), 'dd MMM', { locale: ru })}</div>
                          <div className="text-xs">
                            {formatDistanceToNow(new Date(referral.lastActivityAt), {
                              addSuffix: true,
                              locale: ru
                            })}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs">Never</span>
                      )}
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
