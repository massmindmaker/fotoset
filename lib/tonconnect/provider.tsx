'use client'

/**
 * TonConnect Provider - Simplified version
 *
 * Uses @tonconnect/ui-react for proper React integration
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

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
  connect: () => Promise<boolean>
  disconnect: () => Promise<void>
  sendTransaction: (to: string, amount: number, comment?: string) => Promise<string | null>
  tonConnectUI: any // Expose for direct access if needed
}

const defaultWalletState: WalletState = {
  connected: false,
  address: null,
  loading: true
}

const TonConnectContext = createContext<TonConnectContextValue | null>(null)

interface TonConnectProviderProps {
  children: ReactNode
}

export function TonConnectProvider({ children }: TonConnectProviderProps) {
  const [wallet, setWallet] = useState<WalletState>(defaultWalletState)
  const [tonConnectUI, setTonConnectUI] = useState<any>(null)

  // Initialize TonConnect
  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const { TonConnectUI } = await import('@tonconnect/ui')

        if (!mounted) return

        const ui = new TonConnectUI({
          manifestUrl: MANIFEST_URL,
        })

        // Set return URL for Telegram Mini Apps
        const isTMA = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData
        if (isTMA) {
          ui.uiOptions = {
            twaReturnUrl: 'https://t.me/Pinglass_bot/Pinglass' as `${string}://${string}`,
          }
        }

        console.log('[TonConnect] Initialized, isTMA:', isTMA)

        // Subscribe to wallet changes
        ui.onStatusChange((walletInfo: any) => {
          console.log('[TonConnect] Status changed:', walletInfo ? 'connected' : 'disconnected')

          if (walletInfo) {
            setWallet({
              connected: true,
              address: walletInfo.account.address,
              loading: false
            })
            // Close modal on successful connection
            ui.closeModal()
          } else {
            setWallet({
              connected: false,
              address: null,
              loading: false
            })
          }
        })

        // Wait for connection restoration
        await ui.connectionRestored
        console.log('[TonConnect] Connection restored, connected:', ui.connected)

        if (!mounted) return

        setTonConnectUI(ui)

        // Sync initial state
        if (ui.connected && ui.wallet) {
          setWallet({
            connected: true,
            address: ui.wallet.account.address,
            loading: false
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

  // Poll for connection (backup for TMA)
  useEffect(() => {
    if (!tonConnectUI) return

    const interval = setInterval(() => {
      if (tonConnectUI.connected && tonConnectUI.wallet && !wallet.connected) {
        console.log('[TonConnect] Polling detected connection')
        setWallet({
          connected: true,
          address: tonConnectUI.wallet.account.address,
          loading: false
        })
        tonConnectUI.closeModal()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [tonConnectUI, wallet.connected])

  const connect = useCallback(async (): Promise<boolean> => {
    if (!tonConnectUI) {
      console.error('[TonConnect] UI not ready')
      return false
    }

    try {
      await tonConnectUI.openModal()
      return true
    } catch (error) {
      console.error('[TonConnect] Open modal error:', error)
      return false
    }
  }, [tonConnectUI])

  const disconnect = useCallback(async () => {
    if (!tonConnectUI) return

    try {
      await tonConnectUI.disconnect()
      setWallet({
        connected: false,
        address: null,
        loading: false
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
          payload: comment ? btoa(comment) : undefined
        }]
      }

      const result = await tonConnectUI.sendTransaction(transaction)
      return result.boc
    } catch (error) {
      console.error('[TonConnect] Transaction error:', error)
      return null
    }
  }, [tonConnectUI, wallet.connected])

  return (
    <TonConnectContext.Provider value={{ wallet, connect, disconnect, sendTransaction, tonConnectUI }}>
      {children}
    </TonConnectContext.Provider>
  )
}

export function useTonConnect(): TonConnectContextValue {
  const context = useContext(TonConnectContext)
  if (!context) {
    throw new Error('useTonConnect must be used within TonConnectProvider')
  }
  return context
}

export default TonConnectProvider
