// Upstash QStash Integration for Background Jobs
import { Client, Receiver } from "@upstash/qstash"

// Initialize QStash client
const QSTASH_TOKEN = process.env.QSTASH_TOKEN || ""
const QSTASH_CURRENT_SIGNING_KEY = process.env.QSTASH_CURRENT_SIGNING_KEY || ""
const QSTASH_NEXT_SIGNING_KEY = process.env.QSTASH_NEXT_SIGNING_KEY || ""

export const HAS_QSTASH = !!(QSTASH_TOKEN && QSTASH_CURRENT_SIGNING_KEY)

// Log config (without secrets)
if (typeof window === "undefined" && HAS_QSTASH) {
  console.log("[QStash] Configured and ready")
}

// QStash Client for publishing jobs
export const qstashClient = QSTASH_TOKEN
  ? new Client({ token: QSTASH_TOKEN })
  : null

// QStash Receiver for verifying signatures
export const qstashReceiver =
  QSTASH_CURRENT_SIGNING_KEY && QSTASH_NEXT_SIGNING_KEY
    ? new Receiver({
        currentSigningKey: QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: QSTASH_NEXT_SIGNING_KEY,
      })
    : null

// Job types
export interface GenerationJobPayload {
  jobId: number
  avatarId: number
  deviceId: string
  styleId: string
  photoCount: number
  referenceImages: string[] // base64 encoded
  startIndex: number // For chunked processing
  chunkSize: number
}

export interface JobResult {
  success: boolean
  jobId: number
  photosGenerated: number
  errors: string[]
}

// Publish a generation job to QStash
export async function publishGenerationJob(
  payload: GenerationJobPayload,
  baseUrl: string
): Promise<{ messageId: string } | null> {
  if (!qstashClient) {
    console.error("[QStash] Client not configured")
    return null
  }

  try {
    const result = await qstashClient.publishJSON({
      url: `${baseUrl}/api/jobs/process`,
      body: payload,
      retries: 3,
      // Set timeout to 5 minutes per chunk
      timeout: "5m",
    })

    console.log("[QStash] Job published:", {
      messageId: result.messageId,
      jobId: payload.jobId,
      startIndex: payload.startIndex,
      chunkSize: payload.chunkSize,
    })

    return { messageId: result.messageId }
  } catch (error) {
    console.error("[QStash] Failed to publish job:", error)
    return null
  }
}

// Verify QStash signature
export async function verifyQStashSignature(
  request: Request
): Promise<{ valid: boolean; body: string }> {
  const body = await request.text()

  // Skip verification in development without keys
  if (!qstashReceiver) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[QStash] Skipping signature verification (dev mode)")
      return { valid: true, body }
    }
    return { valid: false, body }
  }

  try {
    const signature = request.headers.get("upstash-signature") || ""
    const isValid = await qstashReceiver.verify({
      signature,
      body,
    })
    return { valid: isValid, body }
  } catch (error) {
    console.error("[QStash] Signature verification failed:", error)
    return { valid: false, body }
  }
}

// Configuration for chunked generation
export const GENERATION_CONFIG = {
  // Photos per chunk (each chunk runs in one serverless invocation)
  CHUNK_SIZE: 5,
  // Max concurrent chunks
  MAX_CONCURRENT: 2,
  // Delay between chunks (ms) to avoid rate limits
  CHUNK_DELAY_MS: 1000,
}
