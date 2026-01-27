'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * Partner Login Page - Redirects to Unified Login
 * Kept for backwards compatibility with old bookmarks/links
 */
export default function PartnerLoginPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to unified login with partner hint
    router.replace('/auth/login?hint=partner')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        <p className="text-muted-foreground">Перенаправление...</p>
      </div>
    </div>
  )
}
