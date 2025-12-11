import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"

// ============================================================================
// Types
// ============================================================================

export type ResourceType = "avatar" | "job" | "reference"

export interface OwnershipResult {
  authorized: boolean
  userId?: number
  resourceExists: boolean
}

// ============================================================================
// Device ID Extraction
// ============================================================================

/**
 * Extract device ID from request headers, query params, or body
 * Priority: x-device-id header > device_id query param > body.deviceId
 */
export function getDeviceId(request: NextRequest, body?: any): string | null {
  // Check header first (most secure)
  const headerDeviceId = request.headers.get("x-device-id")
  if (headerDeviceId) return headerDeviceId

  // Check query parameter
  const queryDeviceId = request.nextUrl.searchParams.get("device_id")
  if (queryDeviceId) return queryDeviceId

  // Check request body
  if (body?.deviceId) return body.deviceId

  return null
}

// ============================================================================
// Resource Ownership Verification
// ============================================================================

/**
 * Verify that a device ID owns a specific resource
 *
 * @param deviceId - User's device identifier
 * @param resourceType - Type of resource (avatar, job, reference)
 * @param resourceId - ID of the resource to check
 * @returns Ownership verification result
 *
 * @example
 * const result = await verifyResourceOwnership(deviceId, 'avatar', avatarId)
 * if (!result.authorized) {
 *   return error("FORBIDDEN", "Access denied")
 * }
 */
export async function verifyResourceOwnership(
  deviceId: string | null,
  resourceType: ResourceType,
  resourceId: number
): Promise<OwnershipResult> {
  if (!deviceId) {
    return { authorized: false, resourceExists: false }
  }

  try {
    let result: any

    switch (resourceType) {
      case "avatar":
        result = await verifyAvatarOwnership(deviceId, resourceId)
        break

      case "job":
        result = await verifyJobOwnership(deviceId, resourceId)
        break

      case "reference":
        result = await verifyReferenceOwnership(deviceId, resourceId)
        break

      default:
        return { authorized: false, resourceExists: false }
    }

    return result
  } catch (error) {
    console.error(`[auth-utils] Failed to verify ${resourceType} ownership:`, error)
    return { authorized: false, resourceExists: false }
  }
}

// ============================================================================
// Resource-Specific Verification
// ============================================================================

/**
 * Verify avatar ownership
 */
async function verifyAvatarOwnership(
  deviceId: string,
  avatarId: number
): Promise<OwnershipResult> {
  const rows = await sql`
    SELECT a.id, a.user_id, u.device_id
    FROM avatars a
    JOIN users u ON u.id = a.user_id
    WHERE a.id = ${avatarId}
  `

  if (rows.length === 0) {
    return { authorized: false, resourceExists: false }
  }

  const avatar = rows[0]
  const authorized = avatar.device_id === deviceId

  return {
    authorized,
    userId: avatar.user_id,
    resourceExists: true,
  }
}

/**
 * Verify generation job ownership (through avatar)
 */
async function verifyJobOwnership(
  deviceId: string,
  jobId: number
): Promise<OwnershipResult> {
  const rows = await sql`
    SELECT j.id, j.avatar_id, a.user_id, u.device_id
    FROM generation_jobs j
    JOIN avatars a ON a.id = j.avatar_id
    JOIN users u ON u.id = a.user_id
    WHERE j.id = ${jobId}
  `

  if (rows.length === 0) {
    return { authorized: false, resourceExists: false }
  }

  const job = rows[0]
  const authorized = job.device_id === deviceId

  return {
    authorized,
    userId: job.user_id,
    resourceExists: true,
  }
}

/**
 * Verify reference photo ownership (through avatar)
 */
async function verifyReferenceOwnership(
  deviceId: string,
  referenceId: number
): Promise<OwnershipResult> {
  const rows = await sql`
    SELECT r.id, r.avatar_id, a.user_id, u.device_id
    FROM reference_photos r
    JOIN avatars a ON a.id = r.avatar_id
    JOIN users u ON u.id = a.user_id
    WHERE r.id = ${referenceId}
  `

  if (rows.length === 0) {
    return { authorized: false, resourceExists: false }
  }

  const reference = rows[0]
  const authorized = reference.device_id === deviceId

  return {
    authorized,
    userId: reference.user_id,
    resourceExists: true,
  }
}

// ============================================================================
// Avatar Ownership (legacy compatibility)
// ============================================================================

/**
 * Legacy function for backward compatibility with existing code
 * Verify avatar ownership and return avatar data
 */
export async function verifyAvatarOwnershipWithData(
  avatarId: number,
  deviceId: string
): Promise<{ avatar: any; authorized: boolean }> {
  const rows = await sql`
    SELECT a.*, u.device_id as owner_device_id
    FROM avatars a
    JOIN users u ON u.id = a.user_id
    WHERE a.id = ${avatarId}
  `

  if (rows.length === 0) {
    return { avatar: null, authorized: false }
  }

  const avatar = rows[0]
  const authorized = avatar.owner_device_id === deviceId

  return { avatar, authorized }
}
