'use client'

import { useState } from 'react'
import { useWithdrawals, useCreateWithdrawal, usePartnerStats } from '@/lib/partner-hooks'
import { WithdrawModal } from '@/components/partner/WithdrawModal'
import { format, formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { MIN_WITHDRAWAL } from '@/lib/partner-types'

export default function PartnerWithdrawalsPage() {
  const [showModal, setShowModal] = useState(false)
  const { data, loading, error, refetch } = useWithdrawals()
  const { stats, refetch: refetchStats } = usePartnerStats()
  const { createWithdrawal, loading: withdrawLoading, error: withdrawError } = useCreateWithdrawal()

  const handleWithdraw = async (formData: {
    payoutMethod: 'card' | 'sbp'
    cardNumber?: string
    phone?: string
    recipientName: string
  }) => {
    const result = await createWithdrawal(formData)
    if (result?.success) {
      refetch()
      refetchStats()
      return true
    }
    return false
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-600',
    processing: 'bg-blue-500/10 text-blue-600',
    completed: 'bg-green-500/10 text-green-600',
    rejected: 'bg-red-500/10 text-red-600'
  }

  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    rejected: 'Rejected'
  }

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
        <h2 className="text-lg font-medium text-red-500">Error loading withdrawals</h2>
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

  const availableBalance = stats?.balance.availableRub || 0
  const canWithdraw = availableBalance >= MIN_WITHDRAWAL

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Withdrawals</h1>
          <p className="text-muted-foreground">
            Manage your payout requests
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          disabled={!canWithdraw}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
          Withdraw Funds
        </button>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Available for Withdrawal</div>
            <div className="text-3xl font-bold text-green-500">
              {availableBalance.toLocaleString('ru-RU')} RUB
            </div>
            {stats?.balance.pendingWithdrawals && stats.balance.pendingWithdrawals > 0 && (
              <div className="text-sm text-yellow-500 mt-1">
                {stats.balance.pendingWithdrawals.toLocaleString('ru-RU')} RUB pending
              </div>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Minimum: {MIN_WITHDRAWAL.toLocaleString('ru-RU')} RUB</p>
            <p>NDFL 13% is automatically deducted</p>
          </div>
        </div>
      </div>

      {/* Withdrawals Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Method
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Payout
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!data?.withdrawals.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No withdrawals yet
                  </td>
                </tr>
              ) : (
                data.withdrawals.map((withdrawal) => (
                  <tr key={withdrawal.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm">
                      <div>{format(new Date(withdrawal.createdAt), 'dd MMM yyyy', { locale: ru })}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(withdrawal.createdAt), {
                          addSuffix: true,
                          locale: ru
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">
                        {withdrawal.amount.toLocaleString('ru-RU')} RUB
                      </div>
                      <div className="text-xs text-muted-foreground">
                        NDFL: -{withdrawal.ndflAmount.toLocaleString('ru-RU')} RUB
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="uppercase text-xs font-medium">
                        {withdrawal.method}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {withdrawal.method === 'card'
                          ? withdrawal.cardNumber
                          : withdrawal.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${statusColors[withdrawal.status]}`}>
                        {statusLabels[withdrawal.status]}
                      </span>
                      {withdrawal.rejectionReason && (
                        <div className="text-xs text-red-500 mt-1">
                          {withdrawal.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-green-500">
                        {withdrawal.payoutAmount.toLocaleString('ru-RU')} RUB
                      </div>
                      {withdrawal.processedAt && (
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(withdrawal.processedAt), 'dd MMM', { locale: ru })}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        availableBalance={availableBalance}
        onSubmit={handleWithdraw}
        loading={withdrawLoading}
        error={withdrawError}
      />
    </div>
  )
}
