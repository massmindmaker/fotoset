/**
 * Partner Packs API Types
 * Type definitions for partner-created style packs
 */

export type PackModerationStatus = "draft" | "pending" | "approved" | "rejected"

export type PackOwnerType = "admin" | "partner"

export interface PackPrompt {
  id: number
  packId: number
  prompt: string
  negativePrompt: string | null
  stylePrefix: string | null
  styleSuffix: string | null
  previewUrl: string | null
  position: number
  isActive: boolean
  createdAt: string
}

export interface PhotoPack {
  id: number
  name: string
  slug: string
  description: string | null
  iconEmoji: string
  previewImages: string[]
  ownerType: PackOwnerType
  partnerUserId: number | null
  moderationStatus: PackModerationStatus
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  usageCount: number
  submittedAt: string | null
  reviewedBy: number | null
  reviewedAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
}

export interface PackWithPrompts extends PhotoPack {
  prompts: PackPrompt[]
  promptCount: number
}

// API Request/Response types

export interface CreatePackRequest {
  name: string
  description?: string
  iconEmoji?: string
  previewImages?: string[]
}

export interface UpdatePackRequest {
  name?: string
  description?: string
  iconEmoji?: string
  previewImages?: string[]
}

export interface CreatePromptRequest {
  prompt: string
  negativePrompt?: string
  stylePrefix?: string
  styleSuffix?: string
  previewUrl?: string
  position?: number
}

export interface UpdatePromptRequest {
  prompt?: string
  negativePrompt?: string
  stylePrefix?: string
  styleSuffix?: string
  previewUrl?: string
  position?: number
}

export interface ListPacksResponse {
  success: true
  packs: (PhotoPack & { promptCount: number })[]
}

export interface GetPackResponse {
  success: true
  pack: PhotoPack
  prompts: PackPrompt[]
}

export interface CreatePackResponse {
  success: true
  pack: PhotoPack
}

export interface UpdatePackResponse {
  success: true
  pack: Partial<PhotoPack>
}

export interface DeletePackResponse {
  success: true
  message: string
}

export interface SubmitPackResponse {
  success: true
  pack: {
    id: number
    name: string
    moderationStatus: PackModerationStatus
    submittedAt: string
    promptCount: number
  }
  message: string
}

export interface ListPromptsResponse {
  success: true
  prompts: PackPrompt[]
}

export interface GetPromptResponse {
  success: true
  prompt: PackPrompt
}

export interface CreatePromptResponse {
  success: true
  prompt: PackPrompt
}

export interface UpdatePromptResponse {
  success: true
  prompt: Partial<PackPrompt>
}

export interface DeletePromptResponse {
  success: true
  message: string
}

export interface ApiErrorResponse {
  error: string
  message: string
}

// Validation constraints
export const PACK_CONSTRAINTS = {
  MAX_PACKS_PER_PARTNER: 5,
  MIN_PROMPTS_FOR_SUBMISSION: 7,
  MAX_PROMPTS_PER_PACK: 23,
  MIN_PROMPTS_TO_KEEP: 1,
  MAX_NAME_LENGTH: 255,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_SLUG_LENGTH: 100,
  PREVIEW_IMAGES_COUNT: 4,
} as const

// State transition rules
export const PACK_STATE_TRANSITIONS: Record<
  PackModerationStatus,
  PackModerationStatus[]
> = {
  draft: ["pending"],
  pending: ["approved", "rejected"],
  approved: [], // Terminal state
  rejected: ["pending"], // Can resubmit
}

// Permissions
export const PACK_PERMISSIONS = {
  canEdit: (status: PackModerationStatus) => status === "draft" || status === "rejected",
  canDelete: (status: PackModerationStatus) => status === "draft",
  canSubmit: (status: PackModerationStatus) =>
    status === "draft" || status === "rejected",
  canAddPrompt: (status: PackModerationStatus) =>
    status === "draft" || status === "rejected",
  canUpdatePrompt: (status: PackModerationStatus) =>
    status === "draft" || status === "rejected",
  canDeletePrompt: (status: PackModerationStatus) =>
    status === "draft" || status === "rejected",
} as const

// Helper functions
export function isPackEditable(pack: PhotoPack): boolean {
  return PACK_PERMISSIONS.canEdit(pack.moderationStatus)
}

export function canSubmitPack(pack: PhotoPack, promptCount: number): {
  canSubmit: boolean
  reason?: string
} {
  if (!PACK_PERMISSIONS.canSubmit(pack.moderationStatus)) {
    return { canSubmit: false, reason: "Pack is already submitted or approved" }
  }

  if (promptCount < PACK_CONSTRAINTS.MIN_PROMPTS_FOR_SUBMISSION) {
    return {
      canSubmit: false,
      reason: `Pack needs at least ${PACK_CONSTRAINTS.MIN_PROMPTS_FOR_SUBMISSION} prompts`,
    }
  }

  if (promptCount > PACK_CONSTRAINTS.MAX_PROMPTS_PER_PACK) {
    return {
      canSubmit: false,
      reason: `Pack cannot have more than ${PACK_CONSTRAINTS.MAX_PROMPTS_PER_PACK} prompts`,
    }
  }

  return { canSubmit: true }
}

export function getPackStatusBadgeColor(status: PackModerationStatus): string {
  switch (status) {
    case "draft":
      return "gray"
    case "pending":
      return "yellow"
    case "approved":
      return "green"
    case "rejected":
      return "red"
    default:
      return "gray"
  }
}

export function getPackStatusLabel(status: PackModerationStatus): string {
  switch (status) {
    case "draft":
      return "Draft"
    case "pending":
      return "Under Review"
    case "approved":
      return "Approved"
    case "rejected":
      return "Rejected"
    default:
      return status
  }
}
