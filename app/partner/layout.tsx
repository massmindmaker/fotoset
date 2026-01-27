import { cookies } from 'next/headers'
import { PartnerNavigation } from '@/components/partner/PartnerNavigation'

export const metadata = {
  title: 'Partner Cabinet - PinGlass',
  description: 'Manage your partner earnings, referrals, and payouts',
}

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check if user has session cookie (basic check - full validation in API/session)
  const cookieStore = await cookies()
  const hasSession = !!cookieStore.get('partner_session')?.value

  // Login page doesn't need navigation
  if (!hasSession) {
    return (
      <div className="min-h-screen bg-background">
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <PartnerNavigation />
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
