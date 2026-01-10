'use client'

/**
 * TonConnect Button Component
 * 
 * A styled button for connecting/disconnecting TON wallets via TonConnect.
 * Shows wallet address when connected, connect button when not.
 */

import { useState } from 'react'
import { useTonConnect } from '@/lib/tonconnect/provider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TonConnectButtonProps {
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  showDisconnect?: boolean
}

export function TonConnectButton({
  className,
  variant = 'default',
  size = 'default',
  showDisconnect = true
}: TonConnectButtonProps) {
  const { wallet, connect, disconnect } = useTonConnect()
  const [isHovered, setIsHovered] = useState(false)

  // Loading state
  if (wallet.loading) {
    return (
      <Button
        variant={variant}
        size={size}
        className={cn('animate-pulse', className)}
        disabled
      >
        <WalletIcon className="w-4 h-4 mr-2" />
        <span>Loading...</span>
      </Button>
    )
  }

  // Connected state
  if (wallet.connected && wallet.address) {
    const shortAddress = `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`

    return (
      <Button
        variant={variant}
        size={size}
        className={cn('group', className)}
        onClick={() => showDisconnect && disconnect()}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <WalletIcon className="w-4 h-4 mr-2 text-green-500" />
        {showDisconnect && isHovered ? (
          <span className="text-red-500">Disconnect</span>
        ) : (
          <span>{wallet.walletName ? `${wallet.walletName}: ` : ''}{shortAddress}</span>
        )}
      </Button>
    )
  }

  // Disconnected state
  return (
    <Button
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={connect}
    >
      <WalletIcon className="w-4 h-4 mr-2" />
      <span>Connect Wallet</span>
    </Button>
  )
}

/**
 * Compact version for payment modal
 */
export function TonConnectCompact({ className }: { className?: string }) {
  const { wallet, connect } = useTonConnect()

  if (wallet.loading) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <WalletIcon className="w-4 h-4 animate-pulse" />
        <span>Checking wallet...</span>
      </div>
    )
  }

  if (wallet.connected && wallet.address) {
    const shortAddress = `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`
    
    return (
      <div className={cn('flex items-center gap-2 text-sm', className)}>
        <WalletIcon className="w-4 h-4 text-green-500" />
        <span className="text-green-600 dark:text-green-400">
          Connected: {shortAddress}
        </span>
      </div>
    )
  }

  return (
    <button
      onClick={connect}
      className={cn(
        'flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700',
        'dark:text-blue-400 dark:hover:text-blue-300 transition-colors',
        className
      )}
    >
      <WalletIcon className="w-4 h-4" />
      <span>Connect TON Wallet</span>
    </button>
  )
}

/**
 * Simple wallet icon (TON-inspired)
 */
function WalletIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </svg>
  )
}

export default TonConnectButton
