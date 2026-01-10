/**
 * Mock for @tonconnect/ui-react
 * Used in tests to simulate TonConnect wallet connections
 */

// Mock wallet data for testing
export const mockWallet = {
  account: {
    address: 'EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2',
    publicKey: 'ed169130705004711b9998b561d8de82d31fbf84910ced6eb5fc92e7485ef8a7',
  },
  device: {
    appName: 'Tonkeeper',
    appVersion: '3.0.0',
    platform: 'ios',
  },
}

// Status change callback holder
let statusChangeCallback: ((wallet: typeof mockWallet | null) => void) | null = null

// Mock TonConnectUI class
export class TonConnectUI {
  connected: boolean = false
  wallet: typeof mockWallet | null = null
  connectionRestored: Promise<void>

  private manifestUrl: string

  constructor(options: { manifestUrl: string }) {
    this.manifestUrl = options.manifestUrl
    this.connectionRestored = Promise.resolve()
  }

  async openModal(): Promise<void> {
    // Simulate modal opening - tests can call mockConnect() to simulate connection
    return Promise.resolve()
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.wallet = null
    if (statusChangeCallback) {
      statusChangeCallback(null)
    }
    return Promise.resolve()
  }

  async sendTransaction(transaction: {
    validUntil: number
    messages: Array<{
      address: string
      amount: string
      payload?: string
    }>
  }): Promise<{ boc: string }> {
    if (!this.connected) {
      throw new Error('Wallet not connected')
    }
    // Return mock transaction hash
    return { boc: 'mock_transaction_boc_' + Date.now() }
  }

  onStatusChange(callback: (wallet: typeof mockWallet | null) => void): void {
    statusChangeCallback = callback
  }

  // Helper methods for testing
  static mockConnect(): void {
    if (statusChangeCallback) {
      statusChangeCallback(mockWallet)
    }
  }

  static mockDisconnect(): void {
    if (statusChangeCallback) {
      statusChangeCallback(null)
    }
  }

  static resetMock(): void {
    statusChangeCallback = null
  }
}

// Export mock wallet for use in tests
export { mockWallet as __mockWallet }
