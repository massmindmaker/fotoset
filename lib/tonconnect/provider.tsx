'use client'

/**
 * TonConnect Provider - Using official @tonconnect/ui-react
 *
 * IMPORTANT: TonConnectUIProvider must be loaded with SSR disabled
 * to work properly in Telegram Mini Apps.
 * See: https://github.com/ton-connect/sdk/issues/230
 */

import dynamic from 'next/dynamic'
import { ReactNode } from 'react'

// Manifest URL - must be accessible from the internet
const MANIFEST_URL = 'https://fotoset.vercel.app/tonconnect-manifest.json'

// CRITICAL: Load TonConnectUIProvider with SSR disabled
// This fixes the infinite loading issue in Telegram Mini Apps
const TonConnectUIProvider = dynamic(
  () => import('@tonconnect/ui-react').then((mod) => mod.TonConnectUIProvider),
  { ssr: false }
)

interface TonConnectProviderProps {
  children: ReactNode
}

export function TonConnectProvider({ children }: TonConnectProviderProps) {
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
