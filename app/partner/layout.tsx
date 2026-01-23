import { PartnerNavigation } from '@/components/partner/PartnerNavigation'

export const metadata = {
  title: 'Partner Cabinet - PinGlass',
  description: 'Manage your partner earnings, referrals, and payouts',
}

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <PartnerNavigation />
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
