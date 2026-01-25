/**
 * Minimal Node.js test endpoint - NO imports at all
 * If this hangs, the problem is at Vercel platform level
 */

export async function GET() {
  return new Response(JSON.stringify({
    status: "ok",
    runtime: "nodejs",
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      hasDbUrl: !!process.env.DATABASE_URL,
    }
  }), {
    headers: { "Content-Type": "application/json" }
  })
}
