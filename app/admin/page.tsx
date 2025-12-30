import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/admin/session'
import { Dashboard } from '@/components/admin/Dashboard'

/**
 * Admin Panel Index Page
 * Shows Dashboard with KPIs and charts
 */
export default async function AdminPage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect('/admin/login')
  }

  return <Dashboard />
}
