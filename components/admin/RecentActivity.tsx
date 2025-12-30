'use client'

import { useState } from 'react'
import { CreditCard, User, Zap, Clock, CheckCircle, XCircle, Loader } from 'lucide-react'

interface RecentActivityProps {
  payments: Array<{
    id: number
    amount: number
    tier: string
    status: string
    createdAt: string
    telegramUserId: string
  }>
  users: Array<{
    id: number
    telegramUserId: string
    createdAt: string
  }>
  generations: Array<{
    id: number
    status: string
    tier: string
    totalPhotos: number
    completedPhotos: number
    createdAt: string
    telegramUserId: string
  }>
}

type TabType = 'payments' | 'users' | 'generations'

export function RecentActivity({ payments, users, generations }: RecentActivityProps) {
  const [activeTab, setActiveTab] = useState<TabType>('payments')

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return 'только что'
    if (minutes < 60) return `${minutes} мин назад`
    if (hours < 24) return `${hours} ч назад`
    return `${days} дн назад`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'succeeded':
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />
      case 'failed':
      case 'canceled':
        return <XCircle className="w-4 h-4 text-red-600" />
      case 'pending':
      case 'processing':
        return <Loader className="w-4 h-4 text-amber-600 animate-spin" />
      default:
        return <Clock className="w-4 h-4 text-slate-400" />
    }
  }

  const tabs = [
    { key: 'payments' as TabType, label: 'Платежи', icon: CreditCard, count: payments.length },
    { key: 'users' as TabType, label: 'Юзеры', icon: User, count: users.length },
    { key: 'generations' as TabType, label: 'Генерации', icon: Zap, count: generations.length }
  ]

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-slate-800 bg-slate-100'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="divide-y divide-slate-100">
        {activeTab === 'payments' && (
          payments.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              Нет недавних платежей
            </div>
          ) : (
            payments.map(payment => (
              <div key={payment.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  {getStatusIcon(payment.status)}
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {payment.amount.toLocaleString('ru-RU')} ₽
                    </p>
                    <p className="text-xs text-slate-500">
                      {payment.tier} • TG: {payment.telegramUserId}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">
                  {formatTime(payment.createdAt)}
                </span>
              </div>
            ))
          )
        )}

        {activeTab === 'users' && (
          users.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              Нет недавних регистраций
            </div>
          ) : (
            users.map(user => (
              <div key={user.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      ID: {user.telegramUserId}
                    </p>
                    <p className="text-xs text-slate-500">
                      User #{user.id}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">
                  {formatTime(user.createdAt)}
                </span>
              </div>
            ))
          )
        )}

        {activeTab === 'generations' && (
          generations.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              Нет недавних генераций
            </div>
          ) : (
            generations.map(gen => (
              <div key={gen.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  {getStatusIcon(gen.status)}
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {gen.tier} • {gen.completedPhotos}/{gen.totalPhotos} фото
                    </p>
                    <p className="text-xs text-slate-500">
                      TG: {gen.telegramUserId}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">
                  {formatTime(gen.createdAt)}
                </span>
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
}
