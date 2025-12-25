import { type NextRequest, NextResponse } from "next/server"

// Allowed domains for image downloads (bypass CORS)
const ALLOWED_DOMAINS = [
  "kie.ai",
  "kieai.erweima.ai",
  "replicate.delivery",
  "replicate.com",
  "pbxt.replicate.delivery",
  "r2.cloudflarestorage.com",
  "pub-8c1af6d8a8944be49e5e168a1b0f03c8.r2.dev",
  "storage.googleapis.com",
]

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url")
    const filename = request.nextUrl.searchParams.get("filename") || "pinglass_photo.png"

    if (!url) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
    }

    // Validate URL format
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
    }

    // Validate domain is allowed
    const hostname = parsedUrl.hostname
    const isAllowed = ALLOWED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    )

    if (!isAllowed) {
      console.warn("[Download] Blocked domain:", hostname)
      return NextResponse.json(
        { error: "Domain not allowed", domain: hostname },
        { status: 403 }
      )
    }

    // Fetch the image
    const response = await fetch(url, {
      headers: {
        "User-Agent": "PinGlass/1.0",
      },
    })

    if (!response.ok) {
      console.error("[Download] Fetch failed:", response.status, response.statusText)
      return NextResponse.json(
        { error: "Failed to fetch image", status: response.status },
        { status: 502 }
      )
    }

    const contentType = response.headers.get("Content-Type") || "image/png"
    const blob = await response.blob()

    if (blob.size === 0) {
      return NextResponse.json({ error: "Empty image" }, { status: 502 })
    }

    // Return image with download headers
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": blob.size.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error) {
    console.error("[Download] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
