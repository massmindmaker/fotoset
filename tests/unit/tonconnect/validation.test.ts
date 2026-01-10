/**
 * Unit tests for TonConnect address validation
 * Tests isValidTonAddress() function from lib/tonconnect/provider.tsx
 */

import { isValidTonAddress } from '@/lib/tonconnect/provider'

describe('isValidTonAddress', () => {
  describe('User-friendly format (EQ.../UQ...)', () => {
    it('should accept valid EQ address', () => {
      // Valid user-friendly bounceable address
      const address = 'EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2'
      expect(isValidTonAddress(address)).toBe(true)
    })

    it('should accept valid UQ address', () => {
      // Valid user-friendly non-bounceable address
      const address = 'UQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2'
      expect(isValidTonAddress(address)).toBe(true)
    })

    it('should accept address with underscores', () => {
      const address = 'EQDtFpEwcFAEcRe5mLVh2N6C0x__hJEM7W61_JLnSF74p4q2'
      expect(isValidTonAddress(address)).toBe(true)
    })

    it('should accept address with dashes', () => {
      const address = 'EQDtFpEwcFAEcRe5mLVh2N6C0x--hJEM7W61_JLnSF74p4q2'
      expect(isValidTonAddress(address)).toBe(true)
    })

    it('should reject address that is too short', () => {
      const address = 'EQDtFpEwcFAEcRe5mLVh2N6C0x'
      expect(isValidTonAddress(address)).toBe(false)
    })

    it('should reject address that is too long', () => {
      const address = 'EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2XXXXX'
      expect(isValidTonAddress(address)).toBe(false)
    })

    it('should reject address with invalid prefix', () => {
      const address = 'XQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2'
      expect(isValidTonAddress(address)).toBe(false)
    })

    it('should reject address with invalid characters', () => {
      const address = 'EQDtFpEwcFAEcRe5mLVh2N6C0x!@hJEM7W61_JLnSF74p4q2'
      expect(isValidTonAddress(address)).toBe(false)
    })
  })

  describe('Raw format (workchain:hash)', () => {
    it('should accept valid raw address with workchain 0', () => {
      const address = '0:ed169130705004711b9998b561d8de82d31fbf84910ced6eb5fc92e7485ef8a7'
      expect(isValidTonAddress(address)).toBe(true)
    })

    it('should accept valid raw address with negative workchain', () => {
      const address = '-1:ed169130705004711b9998b561d8de82d31fbf84910ced6eb5fc92e7485ef8a7'
      expect(isValidTonAddress(address)).toBe(true)
    })

    it('should accept raw address with uppercase hex', () => {
      const address = '0:ED169130705004711B9998B561D8DE82D31FBF84910CED6EB5FC92E7485EF8A7'
      expect(isValidTonAddress(address)).toBe(true)
    })

    it('should reject raw address with invalid hex length', () => {
      const address = '0:ed169130705004711b9998b561d8de82d31fbf84910ced6eb5fc92e7485e'
      expect(isValidTonAddress(address)).toBe(false)
    })

    it('should reject raw address with invalid characters', () => {
      const address = '0:zd169130705004711b9998b561d8de82d31fbf84910ced6eb5fc92e7485ef8a7'
      expect(isValidTonAddress(address)).toBe(false)
    })

    it('should reject raw address without colon', () => {
      const address = '0ed169130705004711b9998b561d8de82d31fbf84910ced6eb5fc92e7485ef8a7'
      expect(isValidTonAddress(address)).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it('should reject empty string', () => {
      expect(isValidTonAddress('')).toBe(false)
    })

    it('should reject null-like values', () => {
      // @ts-expect-error Testing runtime behavior
      expect(isValidTonAddress(null)).toBe(false)
      // @ts-expect-error Testing runtime behavior
      expect(isValidTonAddress(undefined)).toBe(false)
    })

    it('should reject random strings', () => {
      expect(isValidTonAddress('not-an-address')).toBe(false)
      expect(isValidTonAddress('123456789')).toBe(false)
      expect(isValidTonAddress('hello world')).toBe(false)
    })

    it('should reject Ethereum addresses', () => {
      const ethAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f3eE01'
      expect(isValidTonAddress(ethAddress)).toBe(false)
    })

    it('should reject Bitcoin addresses', () => {
      const btcAddress = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2'
      expect(isValidTonAddress(btcAddress)).toBe(false)
    })

    it('should handle whitespace', () => {
      const addressWithSpaces = ' EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2 '
      expect(isValidTonAddress(addressWithSpaces)).toBe(false)
    })
  })

  describe('Real-world addresses', () => {
    it('should accept Tonkeeper test addresses', () => {
      // Common test addresses from Tonkeeper
      const addresses = [
        'EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2',
        'UQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2',
      ]
      addresses.forEach(addr => {
        expect(isValidTonAddress(addr)).toBe(true)
      })
    })
  })
})
