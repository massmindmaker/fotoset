import { TelegramQueueView } from '@/components/admin/TelegramQueueView'

export const metadata = {
  title: 'Telegram Queue | Admin Panel',
  description: 'Мониторинг очереди сообщений Telegram'
}

export default function TelegramPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Telegram Queue</h1>
        <p className="text-zinc-400 mt-1">Мониторинг и управление очередью сообщений</p>
      </div>
      <TelegramQueueView />
    </div>
  )
}
