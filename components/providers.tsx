'use client'

/**
 * Client-side Providers
 *
 * Wraps the application with all client-side context providers.
 * This component is imported by the root layout to provide contexts
 * that require client-side rendering.
 */

import { ReactNode } from 'react'
// TonConnect temporarily disabled for debugging
// import { TonConnectProvider } from '@/lib/tonconnect/provider'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  // TonConnect disabled - testing if it blocks hydration
  return <>{children}</>
}
