import { type NextRequest } from "next/server"
import {
  success,
  error,
  created,
  createLogger,
} from "@/lib/api-utils"
import {
  uploadImage,
  uploadBase64Image,
  generateKey,
  getPublicUrl,
  getUploadSignedUrl,
  isR2Configured,
  getExtensionFromContentType,
  type ImageType,
} from "@/lib/r2"

const logger = createLogger("Upload")

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Allowed MIME types
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]

/**
 * POST /api/upload
 *
 * Upload an image to R2 storage.
 *
 * Supports two modes:
 * 1. Direct upload (multipart/form-data) - for server-side processing
 * 2. Base64 upload (application/json) - for client convenience
 *
 * Request body (JSON):
 * {
 *   "avatarId": "string",        // Required: Avatar ID for key generation
 *   "type": "reference" | "generated" | "thumbnail",  // Image type (default: reference)
 *   "image": "base64string",     // Base64 image data (with or without data URL prefix)
 *   "filename": "photo.jpg"      // Optional: Original filename for extension detection
 * }
 *
 * Request body (FormData):
 * - file: File
 * - avatarId: string
 * - type: "reference" | "generated" | "thumbnail"
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "key": "reference/abc123/1702300800000-x7k9m.jpg",
 *     "url": "https://cdn.example.com/reference/abc123/1702300800000-x7k9m.jpg",
 *     "size": 123456
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  // SECURITY: Require Telegram authentication
  const telegramUserId = request.headers.get("x-telegram-user-id")
  if (!telegramUserId) {
    return error("UNAUTHORIZED", "Telegram authentication required")
  }

  // Check R2 configuration
  if (!isR2Configured()) {
    logger.error("R2 not configured")
    return error(
      "SERVICE_UNAVAILABLE",
      "Image storage is not configured. Please set R2 environment variables."
    )
  }

  try {
    const contentType = request.headers.get("content-type") || ""

    // Handle multipart form data (direct file upload)
    if (contentType.includes("multipart/form-data")) {
      return handleFormDataUpload(request)
    }

    // Handle JSON (base64 upload)
    if (contentType.includes("application/json")) {
      return handleJsonUpload(request)
    }

    return error(
      "BAD_REQUEST",
      "Unsupported content type. Use multipart/form-data or application/json"
    )
  } catch (err) {
    logger.error("Upload failed", { error: err })
    return error(
      "INTERNAL_ERROR",
      "Failed to upload image"
    )
  }
}

/**
 * Handle multipart/form-data upload
 */
async function handleFormDataUpload(request: NextRequest) {
  const formData = await request.formData()

  const file = formData.get("file") as File | null
  const avatarId = formData.get("avatarId") as string | null
  const imageType = (formData.get("type") as ImageType) || "reference"

  if (!file) {
    return error("BAD_REQUEST", "No file provided")
  }

  if (!avatarId) {
    return error("BAD_REQUEST", "avatarId is required")
  }

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return error(
      "BAD_REQUEST",
      `Invalid file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(", ")}`
    )
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return error(
      "PAYLOAD_TOO_LARGE",
      `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
    )
  }

  // Generate storage key
  const extension = getExtensionFromContentType(file.type)
  const key = generateKey(avatarId, imageType, extension)

  // Upload to R2
  const buffer = Buffer.from(await file.arrayBuffer())
  const result = await uploadImage(buffer, key, file.type)

  logger.info("File uploaded via FormData", {
    key: result.key,
    size: result.size,
    avatarId,
    type: imageType,
  })

  return created(result)
}

/**
 * Handle JSON (base64) upload
 */
async function handleJsonUpload(request: NextRequest) {
  const body = await request.json()
  const { avatarId, type: imageType = "reference", image, filename } = body

  if (!avatarId) {
    return error("BAD_REQUEST", "avatarId is required")
  }

  if (!image) {
    return error("BAD_REQUEST", "image (base64) is required")
  }

  // Detect extension from filename or data URL
  let extension = "jpg"
  if (filename) {
    const ext = filename.split(".").pop()
    if (ext) extension = ext.toLowerCase()
  } else if (image.startsWith("data:")) {
    const match = image.match(/^data:image\/(\w+);base64,/)
    if (match) extension = match[1] === "jpeg" ? "jpg" : match[1]
  }

  // Generate storage key
  const key = generateKey(avatarId, imageType as ImageType, extension)

  // Upload to R2
  const result = await uploadBase64Image(image, key)

  // Validate size after decoding
  if (result.size > MAX_FILE_SIZE) {
    return error(
      "PAYLOAD_TOO_LARGE",
      `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
    )
  }

  logger.info("File uploaded via Base64", {
    key: result.key,
    size: result.size,
    avatarId,
    type: imageType,
  })

  return created(result)
}

/**
 * GET /api/upload?avatarId=xxx&type=reference
 *
 * Get a presigned URL for client-side upload.
 * This allows direct browser-to-R2 upload without going through the server.
 *
 * Query params:
 * - avatarId: string (required)
 * - type: "reference" | "generated" | "thumbnail" (default: reference)
 * - contentType: string (default: image/jpeg)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "uploadUrl": "https://...",
 *     "key": "reference/abc123/...",
 *     "publicUrl": "https://cdn.example.com/..."
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  // Check R2 configuration
  if (!isR2Configured()) {
    logger.error("R2 not configured")
    return error(
      "SERVICE_UNAVAILABLE",
      "Image storage is not configured"
    )
  }

  try {
    const { searchParams } = new URL(request.url)

    const avatarId = searchParams.get("avatarId")
    const imageType = (searchParams.get("type") as ImageType) || "reference"
    const contentType = searchParams.get("contentType") || "image/jpeg"

    if (!avatarId) {
      return error("BAD_REQUEST", "avatarId is required")
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      return error(
        "BAD_REQUEST",
        `Invalid content type: ${contentType}. Allowed: ${ALLOWED_TYPES.join(", ")}`
      )
    }

    // Generate key and presigned URL
    const extension = getExtensionFromContentType(contentType)
    const key = generateKey(avatarId, imageType, extension)
    const uploadUrl = await getUploadSignedUrl(key, contentType)
    const publicUrl = getPublicUrl(key)

    logger.info("Generated presigned upload URL", {
      key,
      avatarId,
      type: imageType,
    })

    return success({
      uploadUrl,
      key,
      publicUrl,
    })
  } catch (err) {
    logger.error("Failed to generate presigned URL", { error: err })
    return error(
      "INTERNAL_ERROR",
      "Failed to generate upload URL"
    )
  }
}
