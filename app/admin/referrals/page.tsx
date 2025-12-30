import { ReferralsView } from '@/components/admin/ReferralsView'

export const metadata = {
  title: 'Рефералы | Admin Panel',
  description: 'Управление реферальной системой'
}

export default function ReferralsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Рефералы</h1>
        <p className="text-zinc-400 mt-1">Статистика и управление реферальной системой</p>
      </div>
      <ReferralsView />
    </div>
  )
}
