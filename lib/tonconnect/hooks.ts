'use client'

/**
 * TonConnect Hooks - Using official @tonconnect/ui-react hooks
 *
 * IMPORTANT: These hooks must be used inside TonConnectUIProvider.
 * The provider handles the SSR case by not rendering until mounted.
 */

import {
  useTonConnectUI,
  useTonWallet,
  useTonConnectModal,
  useTonAddress,
  useIsConnectionRestored,
} from '@tonconnect/ui-react'
import { useCallback } from 'react'

export interface WalletState {
  connected: boolean
  address: string | null
  loading: boolean
}

export interface UseTonConnectReturn {
  wallet: WalletState
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  sendTransaction: (to: string, amount: number, comment?: string) => Promise<string | null>
}

/**
 * Custom hook for TonConnect wallet integration
 * Uses official @tonconnect/ui-react hooks internally
 */
export function useTonConnect(): UseTonConnectReturn {
  const [tonConnectUI] = useTonConnectUI()
  const wallet = useTonWallet()
  const address = useTonAddress()
  const connectionRestored = useIsConnectionRestored()
  const { open } = useTonConnectModal()

  // Build wallet state from official hooks
  const walletState: WalletState = {
    connected: !!wallet,
    address: address || null,
    loading: !connectionRestored,
  }

  // Connect wallet - opens modal
  const connect = useCallback(async () => {
    try {
      await open()
    } catch (error) {
      console.error('[TonConnect] Open modal error:', error)
    }
  }, [open])

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      await tonConnectUI.disconnect()
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
    if (!wallet) {
      console.error('[TonConnect] Cannot send: not connected')
      return null
    }

    try {
      const amountNano = BigInt(Math.floor(amount * 1e9))

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600, // 10 min
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
  }, [tonConnectUI, wallet])

  return {
    wallet: walletState,
    connect,
    disconnect,
    sendTransaction,
  }
}

// Re-export official hooks for direct access if needed
export {
  useTonConnectUI,
  useTonWallet,
  useTonConnectModal,
  useTonAddress,
  useIsConnectionRestored,
}
