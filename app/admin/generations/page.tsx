import { GenerationsView } from '@/components/admin/GenerationsView'

export const metadata = {
  title: 'Генерации | Admin Panel',
  description: 'Мониторинг генерации AI-фото'
}

export default function GenerationsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Генерации</h1>
        <p className="text-zinc-400 mt-1">Мониторинг и управление генерацией AI-фото</p>
      </div>
      <GenerationsView />
    </div>
  )
}
