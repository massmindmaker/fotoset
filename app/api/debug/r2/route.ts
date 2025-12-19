import { NextResponse } from "next/server"
import { isR2Configured, uploadBase64Image } from "@/lib/r2"

// Minimal 1x1 red PNG as base64
const TEST_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="

// SECURITY: Disable debug endpoints in production
function checkDebugAccess() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return null
}


/**
 * GET /api/debug/r2
 * Check R2 configuration status
 */
export async function GET() {
  const accessCheck = checkDebugAccess()
  if (accessCheck) return accessCheck

  return NextResponse.json({
    r2Configured: isR2Configured(),
    envVars: {
      R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || "(default: pinglass)",
      R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || "(not set)",
    },
    timestamp: new Date().toISOString(),
  })
}

/**
 * POST /api/debug/r2
 * Test R2 upload functionality
 */
export async function POST() {
  const accessCheck = checkDebugAccess()
  if (accessCheck) return accessCheck

  if (!isR2Configured()) {
    return NextResponse.json(
      {
        success: false,
        error: "R2 not configured",
        details: {
          R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
          R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
          R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
          R2_BUCKET_NAME: !!process.env.R2_BUCKET_NAME,
        },
      },
      { status: 503 }
    )
  }

  try {
    const testKey = `test/ping-${Date.now()}.png`
    const result = await uploadBase64Image(TEST_IMAGE, testKey)

    return NextResponse.json({
      success: true,
      message: "R2 upload test successful",
      result: {
        key: result.key,
        url: result.url,
        size: result.size,
      },
    })
  } catch (err) {
    const error = err as Error
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack?.split("\n").slice(0, 5),
      },
      { status: 500 }
    )
  }
}
