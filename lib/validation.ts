import { z } from "zod"

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
 */
export const GenerateRequestSchema = z.object({
  deviceId: DeviceIdSchema,
  avatarId: AvatarIdSchema,
  styleId: StyleIdSchema,
  referenceImages: z
    .array(z.string().min(1))
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
