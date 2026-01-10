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
import { getAuthenticatedUser } from "@/lib/auth-middleware"

const logger = createLogger("Upload")

/**
 * Compress image using Sharp if available, otherwise return original
 * Compresses to JPEG with quality optimization based on image type
 */
async function compressImage(
  buffer: Buffer,
  imageType: ImageType,
  contentType: string
): Promise<{ buffer: Buffer; contentType: string; size: number }> {
  try {
    // Dynamically import sharp (might not be available in all environments)
    const sharp = await import("sharp").catch(() => null)

    if (!sharp) {
      logger.warn("Sharp not available, skipping compression")
      return { buffer, contentType, size: buffer.length }
    }

    const image = sharp.default(buffer)
    const metadata = await image.metadata()

    // Determine target size and quality based on image type
    let quality = 85
    let maxWidth = 2048
    let maxHeight = 2048

    if (imageType === "thumbnail") {
      quality = 75
      maxWidth = 512
      maxHeight = 512
    } else if (imageType === "reference") {
      quality = 82
      maxWidth = 1920
      maxHeight = 1920
    } else if (imageType === "generated") {
      quality = 90
      maxWidth = 2560
      maxHeight = 2560
    }

    // Resize if image is too large
    let processedImage = image

    if (
      metadata.width &&
      metadata.height &&
      (metadata.width > maxWidth || metadata.height > maxHeight)
    ) {
      processedImage = processedImage.resize(maxWidth, maxHeight, {
        fit: "inside",
        withoutEnlargement: true,
      })
    }

    // Convert to JPEG with quality compression
    const compressedBuffer = await processedImage
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()

    logger.info("Image compressed", {
      originalSize: buffer.length,
      compressedSize: compressedBuffer.length,
      reduction: `${Math.round((1 - compressedBuffer.length / buffer.length) * 100)}%`,
      type: imageType,
    })

    return {
      buffer: compressedBuffer,
      contentType: "image/jpeg",
      size: compressedBuffer.length,
    }
  } catch (err) {
    logger.error("Compression failed, using original", { error: err })
    return { buffer, contentType, size: buffer.length }
  }
}

// Maximum file size: 30MB (optimized for reference photos)
const MAX_FILE_SIZE = 30 * 1024 * 1024

// Target size for reference photos (compressed): 5MB
const MAX_REFERENCE_SIZE = 5 * 1024 * 1024

// Target size for thumbnails: 500KB
const MAX_THUMBNAIL_SIZE = 500 * 1024

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
  // SECURITY: Require authenticated user (Telegram with initData verification OR Neon Auth)
  // SECURITY FIX: Removed x-telegram-user-id header trust - now requires cryptographic verification
  const authUser = await getAuthenticatedUser(request)
  if (!authUser) {
    return error("UNAUTHORIZED", "Authentication required. Provide valid initData or Neon Auth session.")
  }

  logger.info("Upload request authenticated", {
    userId: authUser.user.id,
    authMethod: authUser.authMethod,
    telegramUserId: authUser.telegramUserId,
  })

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

  // Upload to R2 with compression
  let buffer = Buffer.from(await file.arrayBuffer())
  let finalContentType = file.type

  // Compress image before upload (except for generated photos - keep original quality)
  if (imageType !== "generated") {
    const compressed = await compressImage(buffer, imageType, file.type)
    buffer = Buffer.from(compressed.buffer)
    finalContentType = compressed.contentType
  }

  // Generate storage key (always .jpg after compression)
  const extension = imageType === "generated" ? getExtensionFromContentType(file.type) : "jpg"
  const key = generateKey(avatarId, imageType, extension)

  const result = await uploadImage(buffer, key, finalContentType)

  logger.info("File uploaded via FormData", {
    key: result.key,
    size: result.size,
    avatarId,
    type: imageType,
    compressed: imageType !== "generated",
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

  // Decode base64 to buffer first
  let base64Data = image
  if (image.startsWith("data:")) {
    base64Data = image.split(",")[1]
  }

  let buffer = Buffer.from(base64Data, "base64")

  // Validate original size
  if (buffer.length > MAX_FILE_SIZE) {
    return error(
      "PAYLOAD_TOO_LARGE",
      `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
    )
  }

  // Detect content type from data URL or assume JPEG
  let contentType = "image/jpeg"
  if (image.startsWith("data:")) {
    const match = image.match(/^data:(image\/\w+);base64,/)
    if (match) contentType = match[1]
  }

  // Validate content type (same as FormData upload)
  if (!ALLOWED_TYPES.includes(contentType)) {
    return error(
      "BAD_REQUEST",
      `Invalid content type: ${contentType}. Allowed: ${ALLOWED_TYPES.join(", ")}`
    )
  }

  // Compress image before upload (except for generated photos)
  if (imageType !== "generated") {
    const compressed = await compressImage(buffer, imageType as ImageType, contentType)
    buffer = Buffer.from(compressed.buffer)
    contentType = compressed.contentType
  }

  // Generate storage key (always .jpg after compression)
  const extension = imageType === "generated" ? "jpg" : "jpg"
  const key = generateKey(avatarId, imageType as ImageType, extension)

  // Upload compressed buffer to R2
  const result = await uploadImage(buffer, key, contentType)

  logger.info("File uploaded via Base64", {
    key: result.key,
    size: result.size,
    avatarId,
    type: imageType,
    compressed: imageType !== "generated",
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
