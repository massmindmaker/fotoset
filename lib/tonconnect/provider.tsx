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

// Debug logging to server (for TMA where console is not accessible)
const debugLog = async (event: string, data?: Record<string, unknown>) => {
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null
  const logData = {
    event,
    data,
    timestamp: Date.now(),
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    isTMA: !!tg?.initData,
    tgPlatform: tg?.platform || 'unknown',
    tgVersion: tg?.version || 'unknown',
    initDataLength: tg?.initData?.length || 0,
  }
  console.log('[TonConnect]', event, logData)
  try {
    await fetch('/api/debug/tonconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData),
    }).catch(() => {}) // Ignore fetch errors
  } catch {
    // Ignore
  }
}

// Manifest URL for TonConnect protocol
const MANIFEST_URL = typeof window !== 'undefined'
  ? `${window.location.origin}/tonconnect-manifest.json`
  : 'https://fotoset.vercel.app/tonconnect-manifest.json'

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
    let initTimeout: NodeJS.Timeout | null = null

    // Safety timeout: if init takes longer than 10 seconds, set loading to false
    initTimeout = setTimeout(() => {
      if (mounted && wallet.loading) {
        console.warn('[TonConnect] Init timeout - setting loading to false')
        debugLog('init_timeout', { reason: 'TonConnect initialization took too long' })
        setWallet(prev => ({ ...prev, loading: false }))
      }
    }, 10000)

    async function initTonConnect() {
      try {
        // Dynamic import from @tonconnect/ui (vanilla JS) to avoid SSR issues
        // Note: @tonconnect/ui-react exports TonConnectUIProvider, not TonConnectUI class
        const { TonConnectUI } = await import('@tonconnect/ui')

        if (!mounted) return

        // Check if running in Telegram Mini App context
        const tg = window.Telegram?.WebApp
        const isTMA = !!tg?.initData

        debugLog('pre_init', {
          isTMA,
          platform: tg?.platform,
          version: tg?.version,
          initDataPresent: !!tg?.initData,
          manifestUrl: MANIFEST_URL,
        })

        // Create TonConnectUI instance
        // Note: actionsConfiguration.twaReturnUrl is for TWA-TWA redirects
        const ui = new TonConnectUI({
          manifestUrl: MANIFEST_URL,
          actionsConfiguration: {
            // twaReturnUrl must be set for TMA environment to redirect back after wallet action
            twaReturnUrl: isTMA ? TG_BOT_RETURN_URL as `${string}://${string}` : undefined,
            returnStrategy: 'back',
          },
        })

        debugLog('initialized', {
          isTMA,
          manifestUrl: MANIFEST_URL,
          twaReturnUrl: isTMA ? TG_BOT_RETURN_URL : 'N/A',
          uiCreated: !!ui,
        })

        // Subscribe to modal state changes for debugging
        ui.onModalStateChange((state: any) => {
          debugLog('modal_state_change', {
            status: state?.status,
            closeReason: state?.closeReason,
          })
        })

        // CRITICAL: Subscribe to status changes BEFORE connectionRestored
        // This ensures we don't miss the connection event that fires during restoration
        unsubscribe = ui.onStatusChange(
          (walletInfo: any) => {
            if (!mounted) return

            if (walletInfo) {
              debugLog('wallet_connected_onStatusChange', { address: walletInfo.account.address })
              setWallet({
                connected: true,
                address: walletInfo.account.address,
                publicKey: walletInfo.account.publicKey ?? null,
                walletName: walletInfo.device.appName,
                loading: false
              })
            } else {
              debugLog('wallet_disconnected_onStatusChange')
              setWallet({
                ...defaultWalletState,
                loading: false
              })
            }
          },
          (error: any) => {
            debugLog('status_change_error', { error: String(error) })
          }
        )

        // Now wait for connection restoration from localStorage
        // The onStatusChange callback above will catch the connection event
        const restored = await ui.connectionRestored
        debugLog('connection_restored', { restored })

        if (!mounted) return

        setTonConnectUI(ui)

        // IMPORTANT: After connectionRestored, explicitly check current state
        // In case onStatusChange didn't fire (edge case), sync state from ui.wallet
        if (ui.connected && ui.wallet) {
          debugLog('explicit_state_sync', { address: ui.wallet.account.address })
          setWallet({
            connected: true,
            address: ui.wallet.account.address,
            publicKey: ui.wallet.account.publicKey ?? null,
            walletName: ui.wallet.device.appName,
            loading: false
          })
        } else if (!ui.connected) {
          setWallet(prev => ({ ...prev, loading: false }))
        }
      } catch (error) {
        debugLog('init_failed', { error: String(error) })
        if (mounted) {
          setWallet(prev => ({ ...prev, loading: false }))
        }
      }
    }

    initTonConnect()

    return () => {
      mounted = false
      // Properly cleanup subscription and timeout
      if (unsubscribe) {
        unsubscribe()
      }
      if (initTimeout) {
        clearTimeout(initTimeout)
      }
    }
  }, [])

  // Poll wallet connection status (for TMA where events may be missed)
  // This is triggered when user returns to the app after connecting wallet
  useEffect(() => {
    if (!tonConnectUI) return

    let pollInterval: NodeJS.Timeout | null = null

    const checkConnection = () => {
      // Log every poll check for debugging
      const uiConnected = tonConnectUI.connected
      const uiWallet = tonConnectUI.wallet
      const stateConnected = wallet.connected

      if (uiConnected && uiWallet && !stateConnected) {
        debugLog('polling_detected_connection', {
          address: uiWallet.account.address,
          walletName: uiWallet.device?.appName,
        })
        setWallet({
          connected: true,
          address: uiWallet.account.address,
          publicKey: uiWallet.account.publicKey ?? null,
          walletName: uiWallet.device.appName,
          loading: false
        })
      }
    }

    // Handle visibility change (user returns from wallet app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        debugLog('visibility_change', { visible: true, uiConnected: tonConnectUI?.connected })
        // Check immediately
        checkConnection()
        // Also check after a short delay (wallet state may take time to propagate)
        setTimeout(checkConnection, 500)
        setTimeout(checkConnection, 1500)
      }
    }

    // Handle focus (for desktop browsers)
    const handleFocus = () => {
      debugLog('window_focus', { uiConnected: tonConnectUI?.connected })
      checkConnection()
      setTimeout(checkConnection, 500)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    // Poll every 2 seconds while modal might be open
    pollInterval = setInterval(checkConnection, 2000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [tonConnectUI, wallet.connected])

  // Connect wallet
  const connect = useCallback(async (): Promise<boolean> => {
    if (!tonConnectUI) {
      debugLog('connect_failed', { reason: 'UI not initialized' })
      return false
    }

    try {
      // Check if in TMA context
      const isTMA = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData
      debugLog('opening_modal', { isTMA })

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
      debugLog('modal_opened', { waitingForConnection: true })

      // Return true to indicate modal was opened (connection happens async)
      return true
    } catch (error) {
      debugLog('connect_error', { error: String(error) })
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
      debugLog('disconnect_error', { error: String(error) })
    }
  }, [tonConnectUI])

  // Send transaction
  const sendTransaction = useCallback(async (
    to: string,
    amount: number,
    comment?: string
  ): Promise<string | null> => {
    if (!tonConnectUI || !wallet.connected) {
      debugLog('send_failed', { reason: 'Wallet not connected' })
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

      debugLog('sending_transaction', { to, amount, comment })
      const result = await tonConnectUI.sendTransaction(transaction)
      debugLog('transaction_sent', { boc: result.boc?.slice(0, 50) + '...' })
      return result.boc // Transaction hash
    } catch (error) {
      debugLog('transaction_error', { error: String(error) })
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
