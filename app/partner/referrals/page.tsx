'use client'

import { useState } from 'react'
import { usePartnerReferrals, usePartnerStats } from '@/lib/partner-hooks'
import { ReferralsTable } from '@/components/partner/ReferralsTable'
import { Loader2, Copy, Share2 } from 'lucide-react'
import Link from 'next/link'

export default function PartnerReferralsPage() {
  const [page, setPage] = useState(1)
  const { data, loading, error } = usePartnerReferrals(page, 20)
  const { stats } = usePartnerStats()
  const [copied, setCopied] = useState(false)

  const handleCopyLink = async () => {
    if (!stats?.referralCode) return
    const link = `https://pinglass.ru?ref=${stats.referralCode}`
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    if (!stats?.referralCode) return
    const link = `https://pinglass.ru?ref=${stats.referralCode}`
    const text = 'Create amazing AI portraits with PinGlass!'

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'PinGlass',
          text,
          url: link
        })
      } catch {
        // User cancelled or error
      }
    } else {
      handleCopyLink()
    }
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
        <h2 className="text-lg font-medium text-red-500">Error loading referrals</h2>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your Referrals</h1>
          <p className="text-muted-foreground">
            Users who registered with your referral link
          </p>
        </div>

        {stats?.referralCode && (
          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-accent rounded-lg transition-colors"
            >
              <Copy className="w-4 h-4" />
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Total Referrals</div>
            <div className="text-2xl font-bold">{stats.referrals.total}</div>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">With Payments</div>
            <div className="text-2xl font-bold text-green-500">{stats.referrals.withPayments}</div>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Conversion</div>
            <div className="text-2xl font-bold">
              {stats.conversion.registrationToPayment.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Referral Link Card */}
      {stats?.referralCode && (
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-4">
          <div className="text-sm font-medium mb-2">Your Referral Link</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-background/50 rounded font-mono text-sm">
              https://pinglass.ru?ref={stats.referralCode}
            </code>
            <button
              onClick={handleCopyLink}
              className="p-2 hover:bg-background/50 rounded transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Earn {(stats.commissionRate * 100).toFixed(0)}% from every payment your referrals make
          </p>
        </div>
      )}

      {data && (
        <ReferralsTable
          data={data}
          page={page}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
