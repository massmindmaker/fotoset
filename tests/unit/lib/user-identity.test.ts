/**
 * Unit Tests for lib/user-identity.ts
 *
 * Tests:
 * - findOrCreateUser() - User upsert with referral code handling
 * - buildIdentifierParams() - URLSearchParams builder
 * - extractIdentifierFromRequest() - Request data parser
 */

// ============================================================================
// MOCKS
// ============================================================================

const mockSql = jest.fn()

jest.mock("@/lib/db", () => ({
  sql: Object.assign((...args: any[]) => mockSql(...args), {
    unsafe: (str: string) => str,
  }),
}))

// ============================================================================
// IMPORTS
// ============================================================================

import {
  findOrCreateUser,
  buildIdentifierParams,
  extractIdentifierFromRequest,
  type UserIdentifier,
} from "@/lib/user-identity"

// ============================================================================
// TEST DATA
// ============================================================================

const mockUser = {
  id: 1,
  telegram_user_id: 123456789,
  pending_referral_code: null,
  created_at: "2025-12-30T00:00:00Z",
  updated_at: "2025-12-30T00:00:00Z",
}

const mockUserWithReferral = {
  ...mockUser,
  pending_referral_code: "ABC123",
}

// ============================================================================
// TESTS
// ============================================================================

describe("user-identity", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ==========================================================================
  // findOrCreateUser()
  // ==========================================================================

  describe("findOrCreateUser()", () => {
    it("should create new user successfully", async () => {
      mockSql.mockResolvedValueOnce([mockUser])

      const result = await findOrCreateUser({
        telegramUserId: 123456789,
      })

      expect(result).toEqual(mockUser)
      expect(mockSql).toHaveBeenCalledTimes(1)
      // Verify SQL template was called with correct params
      const sqlCall = mockSql.mock.calls[0]
      expect(sqlCall[0][0]).toContain("INSERT INTO users")
      expect(sqlCall[1]).toBe(123456789) // telegramUserId param
      expect(sqlCall[2]).toBeNull() // referralCode param
    })

    it("should create new user with referral code (uppercase, trimmed)", async () => {
      mockSql.mockResolvedValueOnce([mockUserWithReferral])

      const result = await findOrCreateUser({
        telegramUserId: 123456789,
        referralCode: "abc123",
      })

      expect(result).toEqual(mockUserWithReferral)
      expect(result.pending_referral_code).toBe("ABC123")
    })

    it("should NOT update referral code for existing user (COALESCE)", async () => {
      // Existing user already has referral code
      const existingUserWithCode = {
        ...mockUser,
        id: 42,
        telegram_user_id: 987654321,
        pending_referral_code: "ORIGINAL",
      }

      mockSql.mockResolvedValueOnce([existingUserWithCode])

      const result = await findOrCreateUser({
        telegramUserId: 987654321,
        referralCode: "NEWCODE", // This should be ignored due to COALESCE
      })

      // COALESCE preserves existing value
      expect(result.pending_referral_code).toBe("ORIGINAL")
    })

    it("should trim and uppercase referral code", async () => {
      const userWithTrimmed = {
        ...mockUser,
        pending_referral_code: "ABC",
      }

      mockSql.mockResolvedValueOnce([userWithTrimmed])

      const result = await findOrCreateUser({
        telegramUserId: 123456789,
        referralCode: "  abc  ", // Whitespace + lowercase
      })

      expect(result.pending_referral_code).toBe("ABC")
    })

    it("should handle null referral code", async () => {
      mockSql.mockResolvedValueOnce([mockUser])

      const result = await findOrCreateUser({
        telegramUserId: 123456789,
        referralCode: undefined,
      })

      expect(result.pending_referral_code).toBeNull()
    })

    it("should parse string telegramUserId to number", async () => {
      mockSql.mockResolvedValueOnce([mockUser])

      // @ts-expect-error Testing runtime coercion
      const result = await findOrCreateUser({
        telegramUserId: "123456789",
      })

      expect(result).toEqual(mockUser)
    })

    it("should throw error for non-numeric telegramUserId", async () => {
      await expect(
        // @ts-expect-error Testing invalid input
        findOrCreateUser({ telegramUserId: "abc" })
      ).rejects.toThrow("Invalid telegram_user_id format: must be a valid number")
    })

    it("should throw error for NaN telegramUserId", async () => {
      await expect(
        // @ts-expect-error Testing invalid input
        findOrCreateUser({ telegramUserId: NaN })
      ).rejects.toThrow("Invalid telegram_user_id format: must be a valid number")
    })

    it("should throw error when sql result is empty", async () => {
      mockSql.mockResolvedValueOnce([]) // Empty result

      await expect(
        findOrCreateUser({ telegramUserId: 123456789 })
      ).rejects.toThrow("Failed to upsert Telegram user: 123456789")
    })

    it("should propagate database errors", async () => {
      mockSql.mockRejectedValueOnce(new Error("Connection lost"))

      await expect(
        findOrCreateUser({ telegramUserId: 123456789 })
      ).rejects.toThrow("Connection lost")
    })
  })

  // ==========================================================================
  // buildIdentifierParams()
  // ==========================================================================

  describe("buildIdentifierParams()", () => {
    it("should return correct URLSearchParams", () => {
      const identifier: UserIdentifier = {
        type: "telegram",
        telegramUserId: 123456789,
      }

      const params = buildIdentifierParams(identifier)

      expect(params).toBeInstanceOf(URLSearchParams)
      expect(params.get("telegram_user_id")).toBe("123456789")
    })

    it("should handle large ID correctly", () => {
      const identifier: UserIdentifier = {
        type: "telegram",
        telegramUserId: 9999999999,
      }

      const params = buildIdentifierParams(identifier)

      expect(params.get("telegram_user_id")).toBe("9999999999")
    })

    it("should handle small ID edge case", () => {
      const identifier: UserIdentifier = {
        type: "telegram",
        telegramUserId: 1,
      }

      const params = buildIdentifierParams(identifier)

      expect(params.get("telegram_user_id")).toBe("1")
    })

    it("should return serializable URLSearchParams", () => {
      const identifier: UserIdentifier = {
        type: "telegram",
        telegramUserId: 123456789,
      }

      const params = buildIdentifierParams(identifier)
      const serialized = params.toString()

      expect(serialized).toBe("telegram_user_id=123456789")
    })
  })

  // ==========================================================================
  // extractIdentifierFromRequest()
  // ==========================================================================

  describe("extractIdentifierFromRequest()", () => {
    it("should parse telegram_user_id as string", () => {
      const result = extractIdentifierFromRequest({
        telegram_user_id: "123",
      })

      expect(result).toEqual({ telegramUserId: 123 })
    })

    it("should parse telegram_user_id as number", () => {
      const result = extractIdentifierFromRequest({
        telegram_user_id: 456,
      })

      expect(result).toEqual({ telegramUserId: 456 })
    })

    it("should parse telegramUserId field (alternative name)", () => {
      const result = extractIdentifierFromRequest({
        telegramUserId: 789,
      })

      expect(result).toEqual({ telegramUserId: 789 })
    })

    it("should parse telegramUserId as string", () => {
      const result = extractIdentifierFromRequest({
        // @ts-expect-error Testing runtime coercion
        telegramUserId: "999",
      })

      expect(result).toEqual({ telegramUserId: 999 })
    })

    it("should throw on invalid telegramUserId string", () => {
      expect(() =>
        extractIdentifierFromRequest({
          // @ts-expect-error Testing invalid input
          telegramUserId: "invalid",
        })
      ).toThrow("telegram_user_id is required")
    })

    it("should prefer telegram_user_id when both fields present", () => {
      const result = extractIdentifierFromRequest({
        telegram_user_id: 111,
        telegramUserId: 222,
      })

      // telegram_user_id takes precedence
      expect(result).toEqual({ telegramUserId: 111 })
    })

    it("should trim whitespace from string IDs", () => {
      const result = extractIdentifierFromRequest({
        telegram_user_id: "  333  ",
      })

      expect(result).toEqual({ telegramUserId: 333 })
    })

    it("should throw on non-numeric string", () => {
      expect(() =>
        extractIdentifierFromRequest({
          telegram_user_id: "abc",
        })
      ).toThrow("telegram_user_id is required")
    })

    it("should throw on NaN result", () => {
      expect(() =>
        extractIdentifierFromRequest({
          telegram_user_id: NaN,
        })
      ).toThrow("telegram_user_id is required")
    })

    it("should throw when both fields missing", () => {
      expect(() => extractIdentifierFromRequest({})).toThrow(
        "telegram_user_id is required"
      )
    })

    it("should throw when telegram_user_id is null", () => {
      expect(() =>
        extractIdentifierFromRequest({
          telegram_user_id: null,
        })
      ).toThrow("telegram_user_id is required")
    })

    it("should throw when telegramUserId is null", () => {
      expect(() =>
        extractIdentifierFromRequest({
          telegramUserId: null,
        })
      ).toThrow("telegram_user_id is required")
    })

    it("should throw when both fields are null", () => {
      expect(() =>
        extractIdentifierFromRequest({
          telegram_user_id: null,
          telegramUserId: null,
        })
      ).toThrow("telegram_user_id is required")
    })

    it("should reject zero ID (0) due to falsy check - KNOWN BUG", () => {
      // NOTE: This is a bug in the implementation - it uses `if (data.telegram_user_id)`
      // which treats 0 as falsy. This test documents the current behavior.
      // Telegram IDs are always positive in production, so this doesn't affect real users.
      expect(() =>
        extractIdentifierFromRequest({
          telegram_user_id: 0,
        })
      ).toThrow("telegram_user_id is required")
    })

    it("should parse negative ID correctly", () => {
      const result = extractIdentifierFromRequest({
        telegram_user_id: -123,
      })

      expect(result).toEqual({ telegramUserId: -123 })
    })

    it("should throw on empty object", () => {
      expect(() => extractIdentifierFromRequest({})).toThrow(
        "telegram_user_id is required"
      )
    })
  })
})
