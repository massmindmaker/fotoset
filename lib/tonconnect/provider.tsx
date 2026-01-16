'use client'

/**
 * TonConnect Provider - Using official @tonconnect/ui-react
 *
 * CRITICAL: Telegram Mini Apps don't support SSR properly.
 * TonConnectUIProvider must only be rendered on client side.
 */

import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { ReactNode, useEffect, useState } from 'react'

// Manifest URL - must be accessible from the internet
const MANIFEST_URL = 'https://fotoset.vercel.app/tonconnect-manifest.json'

interface TonConnectProviderProps {
  children: ReactNode
}

export function TonConnectProvider({ children }: TonConnectProviderProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // CRITICAL: Don't render anything on server side
  // TonConnectUIProvider requires client-side only
  if (!isClient) {
    // Return a loading placeholder on server
    return (
      <div style={{ minHeight: '100vh' }}>
        {/* Placeholder during SSR - keeps layout stable */}
      </div>
    )
  }

  return (
    <TonConnectUIProvider
      manifestUrl={MANIFEST_URL}
      actionsConfiguration={{
        // Return URL for Telegram Mini Apps
        twaReturnUrl: 'https://t.me/Pinglass_bot/Pinglass' as `${string}://${string}`,
        // Return strategy for regular browsers
        returnStrategy: 'back',
      }}
    >
      {children}
    </TonConnectUIProvider>
  )
}

export default TonConnectProvider

// Re-export useTonConnect hook for backward compatibility
export { useTonConnect } from './hooks'
