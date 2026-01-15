import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner"
import { apiLogger as log } from "./logger"

// ============================================================================
// Configuration
// ============================================================================

// IMPORTANT: Trim env vars to remove accidental newlines/whitespace
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID?.trim()
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID?.trim()
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY?.trim()
const R2_BUCKET_NAME = (process.env.R2_BUCKET_NAME || "pinglass").trim()
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.trim()

/**
 * Check if R2 is properly configured
 */
export function isR2Configured(): boolean {
  return !!(
    R2_ACCOUNT_ID &&
    R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY &&
    R2_BUCKET_NAME
  )
}

/**
 * Lazy-initialized S3 client for Cloudflare R2
 */
let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error(
        "R2 configuration missing. Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY"
      )
    }

    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    })
  }

  return s3Client
}

// ============================================================================
// Types
// ============================================================================

export type ImageType = "reference" | "generated" | "thumbnail"

export interface UploadResult {
  key: string
  url: string
  size: number
}

export interface R2Error {
  code: string
  message: string
}

// ============================================================================
// Key Generation
// ============================================================================

/**
 * Generate a unique key for storing images in R2
 *
 * Key format: {type}/{avatarId}/{timestamp}-{random}.{ext}
 *
 * Examples:
 * - reference/abc123/1702300800000-x7k9m.jpg
 * - generated/abc123/1702300800000-p3n8q.png
 * - thumbnail/abc123/1702300800000-t2w5r.webp
 */
export function generateKey(
  avatarId: string,
  type: ImageType,
  extension: string = "jpg"
): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 7)
  const cleanExt = extension.replace(/^\./, "").toLowerCase()

  return `${type}/${avatarId}/${timestamp}-${random}.${cleanExt}`
}

/**
 * Generate a key for a specific prompt/style combination
 */
export function generatePromptKey(
  avatarId: string,
  styleId: string,
  promptIndex: number,
  extension: string = "png"
): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 5)
  const cleanExt = extension.replace(/^\./, "").toLowerCase()

  return `generated/${avatarId}/${styleId}/${promptIndex}-${timestamp}-${random}.${cleanExt}`
}

/**
 * Extract avatar ID from a key
 */
export function getAvatarIdFromKey(key: string): string | null {
  const parts = key.split("/")
  return parts.length >= 2 ? parts[1] : null
}

// ============================================================================
// Upload Operations
// ============================================================================

/**
 * Upload an image buffer to R2
 *
 * @param buffer - Image data as Buffer
 * @param key - Storage key (use generateKey to create)
 * @param contentType - MIME type (default: image/jpeg)
 * @returns Upload result with key and URL
 */
export async function uploadImage(
  buffer: Buffer,
  key: string,
  contentType: string = "image/jpeg"
): Promise<UploadResult> {
  const client = getS3Client()

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  })

  await client.send(command)

  const url = getPublicUrl(key)

  log.debug(`Uploaded: ${key} (${buffer.length} bytes)`)

  return {
    key,
    url,
    size: buffer.length,
  }
}

/**
 * Upload a base64-encoded image to R2
 *
 * @param base64Data - Base64 string (with or without data URL prefix)
 * @param key - Storage key
 * @returns Upload result
 */
export async function uploadBase64Image(
  base64Data: string,
  key: string
): Promise<UploadResult> {
  // Remove data URL prefix if present
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, "")
  const buffer = Buffer.from(base64Clean, "base64")

  // Detect content type from key extension or default to jpeg
  const ext = key.split(".").pop()?.toLowerCase()
  const contentType = getContentType(ext || "jpg")

  return uploadImage(buffer, key, contentType)
}

/**
 * Upload an image from a URL to R2
 *
 * @param imageUrl - Source URL to fetch
 * @param key - Storage key
 * @returns Upload result
 */
export async function uploadFromUrl(
  imageUrl: string,
  key: string
): Promise<UploadResult> {
  // Add timeout to prevent hanging on slow external images
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20000) // 20s timeout

  try {
    const response = await fetch(imageUrl, { signal: controller.signal })

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const contentType = response.headers.get("content-type") || "image/jpeg"

    return uploadImage(buffer, key, contentType)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Image download timeout after 20s: ${imageUrl}`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

// ============================================================================
// URL Operations
// ============================================================================

/**
 * Get the public URL for a stored image
 *
 * If R2_PUBLIC_URL is configured (custom domain or public bucket URL),
 * returns that. Otherwise returns null (use getSignedUrl instead).
 */
export function getPublicUrl(key: string): string {
  if (R2_PUBLIC_URL) {
    const baseUrl = R2_PUBLIC_URL.replace(/\/$/, "")
    return `${baseUrl}/${key}`
  }

  // Fallback: Use R2 dev URL (only works with public bucket)
  return `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.dev/${key}`
}

/**
 * Generate a presigned URL for private access
 *
 * @param key - Storage key
 * @param expiresIn - URL validity in seconds (default: 1 hour)
 * @returns Presigned URL
 */
export async function getSignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getS3Client()

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })

  return awsGetSignedUrl(client, command, { expiresIn })
}

/**
 * Generate a presigned URL for uploading (client-side upload)
 *
 * @param key - Storage key
 * @param contentType - Expected MIME type
 * @param expiresIn - URL validity in seconds (default: 10 minutes)
 * @returns Presigned upload URL
 */
export async function getUploadSignedUrl(
  key: string,
  contentType: string = "image/jpeg",
  expiresIn: number = 600
): Promise<string> {
  const client = getS3Client()

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  })

  return awsGetSignedUrl(client, command, { expiresIn })
}

// ============================================================================
// Delete Operations
// ============================================================================

/**
 * Delete an image from R2
 *
 * @param key - Storage key to delete
 */
export async function deleteImage(key: string): Promise<void> {
  const client = getS3Client()

  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })

  await client.send(command)

  log.debug(`Deleted: ${key}`)
}

/**
 * Delete multiple images from R2
 *
 * @param keys - Array of storage keys to delete
 */
export async function deleteImages(keys: string[]): Promise<void> {
  // R2 doesn't support DeleteObjects batch, so delete one by one
  await Promise.all(keys.map((key) => deleteImage(key)))
}

/**
 * Delete all images for an avatar
 *
 * Note: This is a prefix-based delete. Use with caution.
 */
export async function deleteAvatarImages(
  avatarId: string,
  type?: ImageType
): Promise<void> {
  // For safety, we don't implement wildcard delete here
  // Instead, track keys in database and delete explicitly
  log.warn("deleteAvatarImages: Track keys in DB and use deleteImages() instead")
}

// ============================================================================
// Utility Operations
// ============================================================================

/**
 * Check if an image exists in R2
 *
 * @param key - Storage key to check
 * @returns true if exists
 */
export async function imageExists(key: string): Promise<boolean> {
  const client = getS3Client()

  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })

    await client.send(command)
    return true
  } catch (error: unknown) {
    const err = error as { name?: string }
    if (err.name === "NotFound") {
      return false
    }
    throw error
  }
}

/**
 * Get content type from file extension
 */
function getContentType(ext: string): string {
  const types: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    svg: "image/svg+xml",
  }

  return types[ext.toLowerCase()] || "image/jpeg"
}

/**
 * Get file extension from content type
 */
export function getExtensionFromContentType(contentType: string): string {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/svg+xml": "svg",
  }

  return extensions[contentType] || "jpg"
}
