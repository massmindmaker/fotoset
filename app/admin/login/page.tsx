'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * Admin Login Page - Redirects to unified login
 * The unified login at /auth/login handles both admin and partner authentication
 */
export default function AdminLoginPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to unified login with admin hint
    router.replace('/auth/login?hint=admin')
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500 mx-auto mb-4" />
        <p className="text-slate-500">Перенаправление...</p>
      </div>
    </div>
  )
}
