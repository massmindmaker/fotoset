// QStash Failure Callback Handler
// Called when QStash exhausts all retries for a job
// Triggers auto-refund for the failed generation

import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { autoRefundForFailedGeneration } from "@/lib/payments/refund-dispatcher"

export const dynamic = "force-dynamic"
export const maxDuration = 60

interface FailurePayload {
  jobId: number
  avatarId: number
  userId: number
  error?: string
  // QStash metadata
  messageId?: string
  topicName?: string
  endpointUrl?: string
  body?: string
}

export async function POST(request: Request) {
  console.log("[Jobs/Failure] Received QStash failure callback")

  try {
    const body = await request.json()

    // QStash sends the original body in the callback
    // Try to parse it if it's a string
    let payload: FailurePayload
    if (typeof body === "string") {
      try {
        payload = JSON.parse(body)
      } catch {
        payload = body as unknown as FailurePayload
      }
    } else {
      payload = body as FailurePayload
    }

    const { jobId, avatarId, userId, error } = payload

    console.log("[Jobs/Failure] Processing failed job:", {
      jobId,
      avatarId,
      userId,
      error: error || "QStash delivery exhausted",
    })

    if (!jobId || !avatarId || !userId) {
      console.error("[Jobs/Failure] Missing required fields in payload")
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 })
    }

    // Mark job as failed
    await sql`
      UPDATE generation_jobs
      SET
        status = 'failed',
        error_message = ${error || "QStash delivery failed after all retries"},
        updated_at = NOW()
      WHERE id = ${jobId}
    `

    // Reset avatar to draft so user can try again
    await sql`
      UPDATE avatars
      SET status = 'draft', updated_at = NOW()
      WHERE id = ${avatarId}
    `

    // Trigger auto-refund
    const refundResult = await autoRefundForFailedGeneration(avatarId, userId)

    console.log("[Jobs/Failure] Processed:", {
      jobId,
      avatarId,
      refundSuccess: refundResult.success,
      refundedPaymentId: refundResult.refundedPaymentId,
      error: refundResult.error,
    })

    return NextResponse.json({
      success: true,
      jobId,
      refundResult,
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error"
    console.error("[Jobs/Failure] Error processing callback:", errorMsg)

    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    )
  }
}
