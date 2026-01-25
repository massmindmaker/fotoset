/**
 * Node.js test with DB - only @neondatabase/serverless import
 */

import { neon } from "@neondatabase/serverless"

export async function GET() {
  const start = Date.now()
  
  try {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      return new Response(JSON.stringify({ error: "No DATABASE_URL" }), { status: 500 })
    }
    
    const sql = neon(dbUrl)
    const result = await sql`SELECT 1 as test`
    
    return new Response(JSON.stringify({
      status: "ok",
      runtime: "nodejs",
      db: "connected",
      result: result[0],
      time: Date.now() - start
    }), {
      headers: { "Content-Type": "application/json" }
    })
  } catch (e) {
    return new Response(JSON.stringify({
      status: "error",
      error: e instanceof Error ? e.message : "unknown",
      time: Date.now() - start
    }), { status: 500 })
  }
}
