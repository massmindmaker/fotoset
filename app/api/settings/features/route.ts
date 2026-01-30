/**
 * GET /api/settings/features
 * 
 * Public API (no authentication required) for feature flags
 * Used by WebApp to determine which features are enabled
 */

import { sql } from "@/lib/db"

export const runtime = 'edge'

export async function GET() {
  try {
    const settings = await sql`
      SELECT key, value FROM admin_settings 
      WHERE key IN ('styles_enabled')
    `
    
    // Parse settings into feature flags
    const getFlag = (key: string, defaultValue: boolean = false): boolean => {
      const setting = settings.find((s: { key: string; value: string }) => s.key === key)
      if (!setting) return defaultValue
      // Handle both JSON-encoded and plain values
      try {
        return JSON.parse(setting.value) === true
      } catch {
        return setting.value === 'true'
      }
    }
    
    const flags = {
      stylesEnabled: getFlag('styles_enabled', false),
    }
    
    return Response.json(flags, {
      headers: {
        // Cache for 1 minute to reduce DB load but still allow quick updates
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30'
      }
    })
  } catch (error) {
    console.error('[Features API] Error:', error)
    // Return defaults on error
    return Response.json({
      stylesEnabled: false,
    })
  }
}
