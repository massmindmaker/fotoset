/**
 * Admin Actions Audit Logger
 *
 * Logs all admin panel operations to admin_actions table
 * for security compliance and audit trails
 */

import { sql } from "@/lib/db"
import type { NextRequest } from "next/server"

export type AdminActionType =
  | "REFUND_CREATED"
  | "PAYMENT_VIEWED"
  | "USER_VIEWED"
  | "LOGS_VIEWED"
  | "STATS_VIEWED"

export type EntityType = "payment" | "user" | "log" | "stat"

/**
 * Log an admin action to the audit trail
 *
 * @param actionType - Type of action (e.g., REFUND_CREATED)
 * @param entityId - ID of the affected entity
 * @param details - Additional details about the action
 * @param request - Optional NextRequest for extracting IP/user-agent
 *
 * @example
 * await logAdminAction('REFUND_CREATED', 123, { amount: 499, reason: 'Failed generation' })
 */
export async function logAdminAction(
  actionType: AdminActionType,
  entityId: number,
  details: Record<string, unknown>,
  request?: NextRequest
): Promise<void> {
  try {
    // TODO: Get actual admin ID from session when auth is enabled
    const adminId = 0 // Placeholder until admin auth is implemented

    const ipAddress = request?.headers.get("x-forwarded-for") ||
                     request?.headers.get("x-real-ip") ||
                     null

    const userAgent = request?.headers.get("user-agent") || null

    // Determine entity type from action
    const entityType: EntityType = actionType.includes("PAYMENT")
      ? "payment"
      : actionType.includes("USER")
      ? "user"
      : actionType.includes("LOG")
      ? "log"
      : "stat"

    await sql`
      INSERT INTO admin_actions (
        admin_telegram_id,
        action_type,
        entity_type,
        entity_id,
        details,
        ip_address,
        user_agent
      )
      VALUES (
        ${adminId},
        ${actionType},
        ${entityType},
        ${entityId},
        ${JSON.stringify(details)},
        ${ipAddress},
        ${userAgent}
      )
    `

    console.log(`[Audit] ${actionType} on ${entityType}:${entityId}`)
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error("[Audit] Failed to log admin action:", error)
  }
}

/**
 * Get recent admin actions for an entity
 *
 * @param entityType - Type of entity
 * @param entityId - ID of entity
 * @param limit - Number of actions to retrieve (default: 10)
 */
export async function getEntityAuditTrail(
  entityType: EntityType,
  entityId: number,
  limit = 10
): Promise<Array<{
  id: number
  admin_telegram_id: number
  action_type: string
  details: Record<string, unknown>
  created_at: string
}>> {
  try {
    const actions = await sql`
      SELECT
        id,
        admin_telegram_id,
        action_type,
        details,
        created_at
      FROM admin_actions
      WHERE entity_type = ${entityType}
        AND entity_id = ${entityId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `

    return actions as Array<{
      id: number
      admin_telegram_id: number
      action_type: string
      details: Record<string, unknown>
      created_at: string
    }>
  } catch (error) {
    console.error("[Audit] Failed to get audit trail:", error)
    return []
  }
}
