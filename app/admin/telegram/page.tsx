'use client'

import { useState } from 'react'
import { TelegramBroadcastView } from '@/components/admin/TelegramBroadcastView'
import { TelegramQueueView } from '@/components/admin/TelegramQueueView'

type TabType = 'broadcast' | 'queue'

export default function TelegramPage() {
  const [activeTab, setActiveTab] = useState<TabType>('broadcast')

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Telegram</h1>
        <p className="text-muted-foreground mt-1">
          Рассылки и управление очередью сообщений
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('broadcast')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'broadcast'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          📢 Рассылка
        </button>
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'queue'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          📬 Очередь
        </button>
      </div>

      {/* Content */}
      {activeTab === 'broadcast' ? (
        <TelegramBroadcastView />
      ) : (
        <TelegramQueueView />
      )}
    </div>
  )
}
