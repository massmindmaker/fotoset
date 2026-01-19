import { z } from "zod"

// ============================================================================
// Security: URL Validation for SSRF Prevention
// ============================================================================

/**
 * Allowed hosts for reference image URLs
 * SECURITY: Only allow URLs from trusted domains to prevent SSRF attacks
 */
const ALLOWED_IMAGE_HOSTS = [
  // Our own R2 storage
  "r2.cloudflarestorage.com",
  "pub-", // R2 public bucket prefix
  // Our domains
  "fotoset.vercel.app",
  "pinglass.ru",
  // Telegram CDN (for user photos)
  "api.telegram.org",
  "t.me",
]

/**
 * Validate that a URL is from a trusted host (SSRF prevention)
 * Returns true for base64 data URIs (safe) and trusted URLs
 */
export function isValidImageUrl(urlOrData: string): boolean {
  // Base64 data URIs are safe (processed locally)
  if (urlOrData.startsWith("data:image/")) {
    return true
  }

  // Must be a valid URL
  try {
    const url = new URL(urlOrData)

    // Only HTTPS allowed (no HTTP, file://, etc.)
    if (url.protocol !== "https:") {
      return false
    }

    // Check hostname against allowlist
    const hostname = url.hostname.toLowerCase()
    return ALLOWED_IMAGE_HOSTS.some(
      (allowed) =>
        hostname === allowed ||
        hostname.endsWith(`.${allowed}`) ||
        hostname.includes(allowed)
    )
  } catch {
    // Invalid URL format
    return false
  }
}

/**
 * Schema for validating reference image (base64 or trusted URL)
 * SECURITY: Prevents SSRF by validating URLs against allowlist
 */
export const SafeImageSchema = z.string().min(1).refine(isValidImageUrl, {
  message:
    "Invalid image: must be a base64 data URI or URL from a trusted domain (r2.cloudflarestorage.com, fotoset.vercel.app, pinglass.ru)",
})

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * Device ID validation
 * - Must be alphanumeric with underscores and hyphens
 * - Length: 10-50 characters
 */
export const DeviceIdSchema = z
  .string()
  .min(10, "Device ID too short (min 10 characters)")
  .max(50, "Device ID too long (max 50 characters)")
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid device ID format")

/**
 * Email validation (optional)
 */
export const EmailSchema = z.string().email("Invalid email format").max(255).optional()

/**
 * Referral code validation
 * - 6 uppercase alphanumeric characters
 */
export const ReferralCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{6}$/, "Invalid referral code format (must be 6 uppercase alphanumeric characters)")
  .optional()

/**
 * Avatar ID validation
 * - Can be a numeric string or number
 */
export const AvatarIdSchema = z.union([
  z.string().regex(/^\d+$/, "Avatar ID must be numeric"),
  z.number().int().positive(),
])

/**
 * Style ID validation
 */
export const StyleIdSchema = z.enum(["professional", "lifestyle", "creative"], {
  message: "Invalid style. Must be: professional, lifestyle, or creative",
})

/**
 * Payment method validation
 */
export const PaymentMethodSchema = z.enum(["card", "sbp", "tpay"]).optional()

// ============================================================================
// API Request Schemas
// ============================================================================

/**
 * POST /api/payment/create
 */
export const PaymentCreateSchema = z.object({
  deviceId: DeviceIdSchema,
  email: EmailSchema,
  paymentMethod: PaymentMethodSchema,
  tierId: z.string().max(50).optional(),
  photoCount: z.number().int().positive().max(100).optional(),
  referralCode: ReferralCodeSchema,
})

export type PaymentCreateRequest = z.infer<typeof PaymentCreateSchema>

/**
 * POST /api/avatars
 */
export const AvatarCreateSchema = z.object({
  deviceId: DeviceIdSchema,
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name too long (max 100 characters)")
    .optional()
    .default("My Avatar"),
})

export type AvatarCreateRequest = z.infer<typeof AvatarCreateSchema>

/**
 * POST /api/referral/apply
 */
export const ReferralApplySchema = z.object({
  deviceId: DeviceIdSchema,
  referralCode: z
    .string()
    .min(1, "Referral code is required")
    .transform((val) => val.toUpperCase().trim())
    .pipe(z.string().regex(/^[A-Z0-9]{6}$/, "Invalid referral code format")),
})

export type ReferralApplyRequest = z.infer<typeof ReferralApplySchema>

/**
 * POST /api/user
 */
export const UserCreateSchema = z
  .object({
    deviceId: DeviceIdSchema.optional(),
    telegramInitData: z.string().optional(),
  })
  .refine(
    (data) => data.deviceId || data.telegramInitData,
    "Either deviceId or telegramInitData is required"
  )

export type UserCreateRequest = z.infer<typeof UserCreateSchema>

/**
 * POST /api/generate
 * SECURITY: referenceImages now validated against trusted URL allowlist to prevent SSRF
 */
export const GenerateRequestSchema = z.object({
  deviceId: DeviceIdSchema,
  avatarId: AvatarIdSchema,
  styleId: StyleIdSchema,
  referenceImages: z
    .array(SafeImageSchema)
    .min(1, "At least one reference image is required")
    .max(20, "Maximum 20 reference images allowed"),
  photoCount: z.number().int().positive().max(23).optional(),
})

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>

// ============================================================================
// Validation Helper
// ============================================================================

/**
 * Validate request body with Zod schema
 * Returns { success: true, data } or { success: false, error }
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string; details?: z.ZodIssue[] } {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  // Format error message from Zod issues
  const errorMessages = result.error.issues.map((issue) => {
    const path = issue.path.join(".")
    return path ? `${path}: ${issue.message}` : issue.message
  })

  return {
    success: false,
    error: errorMessages.join("; "),
    details: result.error.issues,
  }
}

// ============================================================================
// Card Validation
// ============================================================================

/**
 * Validate card number using Luhn algorithm
 * Used for referral withdrawal card validation
 */
export function validateLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "")
  if (digits.length < 13 || digits.length > 19) return false

  let sum = 0
  let isEven = false

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10)
    if (isEven) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    isEven = !isEven
  }

  return sum % 10 === 0
}
