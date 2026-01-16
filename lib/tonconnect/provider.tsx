'use client'

/**
 * TonConnect Provider - Using official @tonconnect/ui-react
 *
 * This is the recommended way to integrate TonConnect with React.
 * Uses TonConnectUIProvider for proper React integration.
 */

import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { ReactNode } from 'react'

// Manifest URL - must be accessible from the internet
const MANIFEST_URL = 'https://fotoset.vercel.app/tonconnect-manifest.json'

interface TonConnectProviderProps {
  children: ReactNode
}

export function TonConnectProvider({ children }: TonConnectProviderProps) {
  // Check if we're in Telegram Mini App
  const isTMA = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData

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
