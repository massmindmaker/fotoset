'use client'

/**
 * TonConnect Provider for PinGlass
 * 
 * Wraps the application with TonConnect context for wallet connections.
 * Supports: Tonkeeper, OpenMask, MyTonWallet, and other TonConnect-compatible wallets.
 * 
 * Usage:
 * 1. Wrap your app with <TonConnectProvider>
 * 2. Use useTonConnect() hook to access wallet state
 * 3. Use <TonConnectButton /> for wallet connection UI
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

// Manifest URL for TonConnect protocol
const MANIFEST_URL = typeof window !== 'undefined'
  ? `${window.location.origin}/tonconnect-manifest.json`
  : 'https://pinglass.ru/tonconnect-manifest.json'

// Telegram Mini App return URL (critical for wallet connection in TMA)
// This URL is used by wallets to redirect back to our TMA after connection/transaction
// Format: https://t.me/<bot_username>/<mini_app_short_name>
const TG_BOT_RETURN_URL = 'https://t.me/Pinglass_bot/Pinglass'

// Wallet connection state
interface WalletState {
  connected: boolean
  address: string | null
  publicKey: string | null
  walletName: string | null
  loading: boolean
}

// TonConnect context value
interface TonConnectContextValue {
  wallet: WalletState
  connect: () => Promise<boolean>
  disconnect: () => Promise<void>
  sendTransaction: (to: string, amount: number, comment?: string) => Promise<string | null>
}

const defaultWalletState: WalletState = {
  connected: false,
  address: null,
  publicKey: null,
  walletName: null,
  loading: true
}

const TonConnectContext = createContext<TonConnectContextValue | null>(null)

interface TonConnectProviderProps {
  children: ReactNode
}

/**
 * TonConnect Provider Component
 * 
 * Note: This is a placeholder implementation.
 * Full implementation requires @tonconnect/ui-react package.
 * 
 * Install with: npm install @tonconnect/ui-react
 */
export function TonConnectProvider({ children }: TonConnectProviderProps) {
  const [wallet, setWallet] = useState<WalletState>(defaultWalletState)
  const [tonConnectUI, setTonConnectUI] = useState<any>(null)

  // Initialize TonConnect UI
  useEffect(() => {
    let mounted = true
    let unsubscribe: (() => void) | null = null

    async function initTonConnect() {
      try {
        // Dynamic import from @tonconnect/ui (vanilla JS) to avoid SSR issues
        // Note: @tonconnect/ui-react exports TonConnectUIProvider, not TonConnectUI class
        const { TonConnectUI } = await import('@tonconnect/ui')

        if (!mounted) return

        // Check if running in Telegram Mini App context
        const isTMA = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData

        // Build actionsConfiguration based on environment
        // For connection, don't set skipRedirectToWallet - allow wallets to open
        const ui = new TonConnectUI({
          manifestUrl: MANIFEST_URL,
          actionsConfiguration: isTMA ? {
            twaReturnUrl: TG_BOT_RETURN_URL as `${string}://${string}`,
            returnStrategy: 'back',
          } : {
            returnStrategy: 'back',
          },
        })

        console.log('[TonConnect] Initialized:', {
          isTMA,
          manifestUrl: MANIFEST_URL,
          twaReturnUrl: isTMA ? TG_BOT_RETURN_URL : 'N/A',
        })

        // Restore connection from storage
        const restored = await ui.connectionRestored
        console.log('[TonConnect] Connection restored:', restored)

        if (!mounted) return

        setTonConnectUI(ui)

        // Subscribe to connection changes - this is the single source of truth
        unsubscribe = ui.onStatusChange(
          (walletInfo: any) => {
            if (!mounted) return

            if (walletInfo) {
              console.log('[TonConnect] Wallet connected:', walletInfo.account.address)
              setWallet({
                connected: true,
                address: walletInfo.account.address,
                publicKey: walletInfo.account.publicKey ?? null,
                walletName: walletInfo.device.appName,
                loading: false
              })
            } else {
              console.log('[TonConnect] Wallet disconnected')
              setWallet({
                ...defaultWalletState,
                loading: false
              })
            }
          },
          (error: any) => {
            console.error('[TonConnect] Status change error:', error)
          }
        )

        // Set initial loading to false if not connected
        // The onStatusChange callback will handle connected state
        if (!ui.connected) {
          setWallet(prev => ({ ...prev, loading: false }))
        }
      } catch (error) {
        console.error('[TonConnect] Failed to initialize:', error)
        if (mounted) {
          setWallet(prev => ({ ...prev, loading: false }))
        }
      }
    }

    initTonConnect()

    return () => {
      mounted = false
      // Properly cleanup subscription
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  // Connect wallet
  const connect = useCallback(async (): Promise<boolean> => {
    if (!tonConnectUI) {
      console.warn('[TonConnect] UI not initialized')
      return false
    }

    try {
      console.log('[TonConnect] Opening modal...')
      // Check if in TMA context
      const isTMA = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData

      // Set appropriate return URL for TMA before opening modal
      // Don't use skipRedirectToWallet for connect - allow wallet to open
      if (isTMA) {
        tonConnectUI.uiOptions = {
          actionsConfiguration: {
            twaReturnUrl: TG_BOT_RETURN_URL as `${string}://${string}`,
            returnStrategy: 'back',
          }
        }
      }

      await tonConnectUI.openModal()
      console.log('[TonConnect] Modal opened, waiting for connection...')

      // Return true to indicate modal was opened (connection happens async)
      return true
    } catch (error) {
      console.error('[TonConnect] Connect error:', error)
      return false
    }
  }, [tonConnectUI])

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    if (!tonConnectUI) return

    try {
      await tonConnectUI.disconnect()
      setWallet({
        ...defaultWalletState,
        loading: false
      })
    } catch (error) {
      console.error('[TonConnect] Disconnect error:', error)
    }
  }, [tonConnectUI])

  // Send transaction
  const sendTransaction = useCallback(async (
    to: string,
    amount: number,
    comment?: string
  ): Promise<string | null> => {
    if (!tonConnectUI || !wallet.connected) {
      console.warn('[TonConnect] Wallet not connected')
      return null
    }

    try {
      // Check if in TMA context
      const isTMA = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData

      // Set skipRedirectToWallet for transactions (not for connect)
      // This prevents redirect issues on iOS when there are async calls before transaction
      if (isTMA) {
        tonConnectUI.uiOptions = {
          actionsConfiguration: {
            twaReturnUrl: TG_BOT_RETURN_URL as `${string}://${string}`,
            returnStrategy: 'back',
            skipRedirectToWallet: 'ios', // Only for sendTransaction!
          }
        }
      }

      // Amount in nanotons (1 TON = 10^9 nanotons)
      const amountNano = BigInt(Math.floor(amount * 1e9))

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes
        messages: [
          {
            address: to,
            amount: amountNano.toString(),
            payload: comment ? btoa(comment) : undefined // Base64 encoded comment
          }
        ]
      }

      console.log('[TonConnect] Sending transaction:', { to, amount, comment })
      const result = await tonConnectUI.sendTransaction(transaction)
      console.log('[TonConnect] Transaction sent:', result.boc)
      return result.boc // Transaction hash
    } catch (error) {
      console.error('[TonConnect] Transaction error:', error)
      return null
    }
  }, [tonConnectUI, wallet.connected])

  return (
    <TonConnectContext.Provider value={{ wallet, connect, disconnect, sendTransaction }}>
      {children}
    </TonConnectContext.Provider>
  )
}

/**
 * Hook to access TonConnect context
 */
export function useTonConnect(): TonConnectContextValue {
  const context = useContext(TonConnectContext)
  if (!context) {
    throw new Error('useTonConnect must be used within TonConnectProvider')
  }
  return context
}

/**
 * Validate TON address format
 * Supports both raw and user-friendly formats
 */
export function isValidTonAddress(address: string): boolean {
  // User-friendly format: EQ... or UQ... (48 chars base64)
  // Raw format: 0:... (66 chars hex)
  const userFriendlyRegex = /^[EU]Q[A-Za-z0-9_-]{46}$/
  const rawRegex = /^-?[0-9]+:[a-fA-F0-9]{64}$/

  return userFriendlyRegex.test(address) || rawRegex.test(address)
}

export default TonConnectProvider
