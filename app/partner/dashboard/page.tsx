'use client'

import { usePartnerStats, usePartnerEarnings } from '@/lib/partner-hooks'
import { StatsCards } from '@/components/partner/StatsCards'
import { EarningsChart } from '@/components/partner/EarningsChart'
import { RecentEarnings } from '@/components/partner/RecentEarnings'
import { Copy, ExternalLink, Loader2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'

export default function PartnerDashboardPage() {
  const { stats, loading: statsLoading, error: statsError } = usePartnerStats()
  const { data: earningsData, loading: earningsLoading } = usePartnerEarnings(1, 5)
  const [copied, setCopied] = useState(false)

  const handleCopyReferralLink = async () => {
    if (!stats?.referralCode) return

    const link = `https://pinglass.ru?ref=${stats.referralCode}`
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (statsError || !stats) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium text-red-500">Error loading data</h2>
        <p className="text-muted-foreground mt-2">{statsError || 'Unknown error'}</p>
        <Link
          href="/"
          className="inline-block mt-4 text-primary hover:underline"
        >
          Return to app
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with referral link */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Partner Dashboard</h1>
          <p className="text-muted-foreground">
            Commission rate: {(stats.commissionRate * 100).toFixed(0)}%
            {stats.isPartner && (
              <span className="ml-2 px-2 py-0.5 bg-purple-500/10 text-purple-500 text-xs rounded-full">
                Partner
              </span>
            )}
          </p>
        </div>

        {stats.referralCode && (
          <div className="flex items-center gap-2">
            <div className="px-3 py-2 bg-muted rounded-lg font-mono text-sm">
              pinglass.ru?ref={stats.referralCode}
            </div>
            <button
              onClick={handleCopyReferralLink}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
              title="Copy referral link"
            >
              {copied ? (
                <span className="text-green-500 text-sm">Copied!</span>
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <StatsCards stats={stats} />

      {/* Charts and Recent */}
      <div className="grid lg:grid-cols-2 gap-6">
        <EarningsChart data={stats.monthlyEarnings} />
        <RecentEarnings earnings={earningsData?.earnings || []} />
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/partner/withdrawals"
          className="bg-card border rounded-lg p-4 hover:border-primary transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Withdraw Funds</div>
              <div className="text-sm text-muted-foreground">
                {stats.balance.availableRub >= 5000
                  ? 'Available now'
                  : `Min: 5,000 RUB`}
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
          </div>
        </Link>

        <Link
          href="/partner/referrals"
          className="bg-card border rounded-lg p-4 hover:border-primary transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">View Referrals</div>
              <div className="text-sm text-muted-foreground">
                {stats.referrals.total} total
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
          </div>
        </Link>

        <Link
          href="/partner/earnings"
          className="bg-card border rounded-lg p-4 hover:border-primary transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Earnings History</div>
              <div className="text-sm text-muted-foreground">
                All transactions
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
          </div>
        </Link>

        <Link
          href="/partner/packs"
          className="bg-card border rounded-lg p-4 hover:border-primary transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">My Packs</div>
              <div className="text-sm text-muted-foreground">
                Create & manage
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
          </div>
        </Link>
      </div>
    </div>
  )
}
