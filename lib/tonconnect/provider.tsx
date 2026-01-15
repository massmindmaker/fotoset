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
  : 'https://pinglass.app/tonconnect-manifest.json'

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
  connect: () => Promise<void>
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

    async function initTonConnect() {
      try {
        // Dynamic import to avoid SSR issues
        const { TonConnectUI } = await import('@tonconnect/ui-react')
        
        if (!mounted) return

        // Check if running in Telegram Mini App context
        const isTMA = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData

        const ui = new TonConnectUI({
          manifestUrl: MANIFEST_URL,
          // CRITICAL: Set actionsConfiguration for Telegram Mini Apps
          // Without this, wallet cannot redirect back to the app after connection
          actionsConfiguration: {
            // twaReturnUrl is used by wallets in Telegram to return to our Mini App
            twaReturnUrl: TG_BOT_RETURN_URL,
            // Skip redirect confirmation in TMA context for smoother UX
            skipRedirectToWallet: isTMA ? 'ios' : undefined,
          },
        })

        // Set UI options for better TMA integration
        // actionsConfiguration.twaReturnUrl is the correct path
        ui.uiOptions = {
          actionsConfiguration: {
            twaReturnUrl: TG_BOT_RETURN_URL,
          }
        }

        console.log('[TonConnect] Initialized:', {
          isTMA,
          manifestUrl: MANIFEST_URL,
          twaReturnUrl: TG_BOT_RETURN_URL,
        })

        // Restore connection from storage
        await ui.connectionRestored

        setTonConnectUI(ui)

        // Subscribe to connection changes
        ui.onStatusChange((wallet: any) => {
          if (wallet) {
            setWallet({
              connected: true,
              address: wallet.account.address,
              publicKey: wallet.account.publicKey ?? null,
              walletName: wallet.device.appName,
              loading: false
            })
          } else {
            setWallet({
              ...defaultWalletState,
              loading: false
            })
          }
        })

        // Check initial state
        if (ui.connected && ui.wallet) {
          setWallet({
            connected: true,
            address: ui.wallet.account.address,
            publicKey: ui.wallet.account.publicKey ?? null,
            walletName: ui.wallet.device.appName,
            loading: false
          })
        } else {
          setWallet(prev => ({ ...prev, loading: false }))
        }
      } catch (error) {
        console.error('[TonConnect] Failed to initialize:', error)
        setWallet(prev => ({ ...prev, loading: false }))
      }
    }

    initTonConnect()

    return () => {
      mounted = false
    }
  }, [])

  // Connect wallet
  const connect = useCallback(async () => {
    if (!tonConnectUI) {
      console.warn('[TonConnect] UI not initialized')
      return
    }

    try {
      console.log('[TonConnect] Opening modal...')
      // Ensure twaReturnUrl is set before opening modal
      tonConnectUI.uiOptions = {
        actionsConfiguration: {
          twaReturnUrl: TG_BOT_RETURN_URL,
        }
      }
      await tonConnectUI.openModal()
      console.log('[TonConnect] Modal opened')
    } catch (error) {
      console.error('[TonConnect] Connect error:', error)
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

      const result = await tonConnectUI.sendTransaction(transaction)
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
