'use client'

/**
 * TonConnect Provider - Manual implementation for full control
 *
 * Uses @tonconnect/ui directly (not React wrapper) to avoid SSR issues
 * and have full control over the lifecycle.
 *
 * v2.0 - Simplified Context-based approach that always renders children
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

/**
 * Validate TON address format
 * Supports both user-friendly (EQ/UQ) and raw (workchain:hex) formats
 */
export function isValidTonAddress(address: string | null | undefined): boolean {
  // Handle null/undefined/non-string values
  if (!address || typeof address !== 'string') return false

  // User-friendly format: EQ... or UQ... (48 chars base64)
  const userFriendlyRegex = /^[EU]Q[A-Za-z0-9_-]{46}$/
  // Raw format: -1:... or 0:... (workchain:hex, 64 chars hex part)
  const rawRegex = /^-?[0-9]+:[a-fA-F0-9]{64}$/

  return userFriendlyRegex.test(address) || rawRegex.test(address)
}

// Manifest URL
const MANIFEST_URL = 'https://fotoset.vercel.app/tonconnect-manifest.json'

// Wallet state
interface WalletState {
  connected: boolean
  address: string | null
  loading: boolean
}

interface TonConnectContextValue {
  wallet: WalletState
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  sendTransaction: (to: string, amount: number, comment?: string) => Promise<string | null>
}

const defaultWalletState: WalletState = {
  connected: false,
  address: null,
  loading: true,
}

const TonConnectContext = createContext<TonConnectContextValue>({
  wallet: defaultWalletState,
  connect: async () => {},
  disconnect: async () => {},
  sendTransaction: async () => null,
})

interface TonConnectProviderProps {
  children: ReactNode
}

export function TonConnectProvider({ children }: TonConnectProviderProps) {
  const [wallet, setWallet] = useState<WalletState>(defaultWalletState)
  const [tonConnectUI, setTonConnectUI] = useState<any>(null)

  // Initialize TonConnect on client only
  useEffect(() => {
    // Skip on server
    if (typeof window === 'undefined') return

    let mounted = true

    async function init() {
      try {
        const { TonConnectUI } = await import('@tonconnect/ui')

        if (!mounted) return

        const ui = new TonConnectUI({
          manifestUrl: MANIFEST_URL,
        })

        // Configure for Telegram Mini Apps
        const isTMA = !!window.Telegram?.WebApp?.initData
        if (isTMA) {
          (ui as any).uiOptions = {
            twaReturnUrl: 'https://t.me/Pinglass_bot/Pinglass',
          }
        }

        // Subscribe to wallet changes
        ui.onStatusChange((walletInfo: any) => {
          if (!mounted) return

          if (walletInfo) {
            setWallet({
              connected: true,
              address: walletInfo.account.address,
              loading: false,
            })
            // Auto-close modal when connected
            ui.closeModal()
          } else {
            setWallet({
              connected: false,
              address: null,
              loading: false,
            })
          }
        })

        // Wait for connection restore
        await ui.connectionRestored

        if (!mounted) return

        setTonConnectUI(ui)

        // Set initial state
        if (ui.connected && ui.wallet) {
          setWallet({
            connected: true,
            address: ui.wallet.account.address,
            loading: false,
          })
        } else {
          setWallet(prev => ({ ...prev, loading: false }))
        }

      } catch (error) {
        console.error('[TonConnect] Init error:', error)
        if (mounted) {
          setWallet(prev => ({ ...prev, loading: false }))
        }
      }
    }

    init()

    return () => {
      mounted = false
    }
  }, [])

  // Backup polling for TMA (events may not fire)
  useEffect(() => {
    if (!tonConnectUI) return

    const interval = setInterval(() => {
      if (tonConnectUI.connected && tonConnectUI.wallet && !wallet.connected) {
        setWallet({
          connected: true,
          address: tonConnectUI.wallet.account.address,
          loading: false,
        })
        tonConnectUI.closeModal()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [tonConnectUI, wallet.connected])

  const connect = useCallback(async () => {
    if (!tonConnectUI) {
      console.error('[TonConnect] UI not ready')
      return
    }

    try {
      await tonConnectUI.openModal()
    } catch (error) {
      console.error('[TonConnect] Open modal error:', error)
    }
  }, [tonConnectUI])

  const disconnect = useCallback(async () => {
    if (!tonConnectUI) return

    try {
      await tonConnectUI.disconnect()
      setWallet({
        connected: false,
        address: null,
        loading: false,
      })
    } catch (error) {
      console.error('[TonConnect] Disconnect error:', error)
    }
  }, [tonConnectUI])

  const sendTransaction = useCallback(async (
    to: string,
    amount: number,
    comment?: string
  ): Promise<string | null> => {
    if (!tonConnectUI || !wallet.connected) {
      console.error('[TonConnect] Cannot send: not connected')
      return null
    }

    try {
      const amountNano = BigInt(Math.floor(amount * 1e9))

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [{
          address: to,
          amount: amountNano.toString(),
          payload: comment ? btoa(comment) : undefined,
        }],
      }

      const result = await tonConnectUI.sendTransaction(transaction)
      return result.boc
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

export function useTonConnect(): TonConnectContextValue {
  return useContext(TonConnectContext)
}

export default TonConnectProvider
