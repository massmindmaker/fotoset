/**
 * GET /api/admin/packs/[id]/prompts - Get prompts for a pack
 *
 * Used by PackModerationView to display pack prompts when expanded
 * Requires admin authentication
 * @see components/admin/PackModerationView.tsx
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Admin auth check
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const packId = parseInt(id, 10)

    if (isNaN(packId)) {
      return NextResponse.json({ error: 'Invalid pack ID' }, { status: 400 })
    }

    const sql = getSql()

    // Verify pack exists
    const packCheck = await sql`
      SELECT id FROM photo_packs WHERE id = ${packId}
    `
    if (packCheck.length === 0) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
    }

    // Get all prompts for this pack
    const prompts = await sql`
      SELECT id, prompt, negative_prompt, position
      FROM pack_prompts
      WHERE pack_id = ${packId}
      ORDER BY position ASC, id ASC
    `

    // Map to expected interface (PackPrompt from PackModerationView)
    // Interface expects: id, name, promptText, negativePrompt, order
    return NextResponse.json({
      prompts: prompts.map((p: Record<string, unknown>, idx: number) => ({
        id: p.id as number,
        name: `Prompt ${idx + 1}`,
        promptText: p.prompt as string,
        negativePrompt: p.negative_prompt as string | null,
        order: (p.position as number) ?? idx,
      })),
    })
  } catch (error) {
    console.error('[Admin Pack Prompts] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    )
  }
}
