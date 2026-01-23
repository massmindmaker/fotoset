'use client'

import { Wallet, Users, TrendingUp, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PartnerStats } from '@/lib/partner-types'

interface StatsCardsProps {
  stats: PartnerStats
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'Available Balance',
      value: `${stats.balance.availableRub.toLocaleString('ru-RU')} RUB`,
      subtitle: stats.balance.pendingWithdrawals > 0
        ? `${stats.balance.pendingWithdrawals.toLocaleString('ru-RU')} RUB pending`
        : undefined,
      icon: <Wallet className="w-5 h-5" />,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Total Referrals',
      value: stats.referrals.total.toString(),
      subtitle: `${stats.referrals.withPayments} with payments`,
      icon: <Users className="w-5 h-5" />,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Total Earned',
      value: `${stats.totalEarned.rub.toLocaleString('ru-RU')} RUB`,
      subtitle: stats.totalEarned.ton > 0
        ? `+ ${stats.totalEarned.ton.toFixed(2)} TON`
        : undefined,
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Total Withdrawn',
      value: `${stats.totalWithdrawn.rub.toLocaleString('ru-RU')} RUB`,
      subtitle: stats.pendingEarnings.count > 0
        ? `${stats.pendingEarnings.count} pending`
        : undefined,
      icon: <Clock className="w-5 h-5" />,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-card border rounded-lg p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{card.title}</span>
            <div className={cn("p-2 rounded-lg", card.bgColor)}>
              <span className={card.color}>{card.icon}</span>
            </div>
          </div>
          <div className="text-2xl font-bold">{card.value}</div>
          {card.subtitle && (
            <div className="text-xs text-muted-foreground">{card.subtitle}</div>
          )}
        </div>
      ))}
    </div>
  )
}
