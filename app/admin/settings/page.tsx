import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/admin/session'
import { SettingsView } from '@/components/admin/SettingsView'

export default async function SettingsPage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect('/admin/login')
  }

  return <SettingsView />
}
