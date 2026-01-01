import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'
import { generateWithKie, isKieConfigured } from '@/lib/kie'
import { uploadFromUrl, getPublicUrl, isR2Configured } from '@/lib/r2'

function getSql() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }
  return neon(connectionString)
}

/**
 * POST /api/admin/prompts/generate-preview
 * Generate a preview image for a saved prompt using Kie.ai
 *
 * Body: { promptId: number, referenceImageUrl?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' } },
        { status: 401 }
      )
    }

    if (!isKieConfigured()) {
      return NextResponse.json(
        { error: { code: 'KIE_NOT_CONFIGURED', message: 'Kie.ai API не настроен' } },
        { status: 500 }
      )
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: { code: 'R2_NOT_CONFIGURED', message: 'R2 storage не настроен' } },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { promptId, referenceImageUrl } = body

    if (!promptId) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'promptId обязателен' } },
        { status: 400 }
      )
    }

    const sql = getSql()

    // Get the prompt
    const [prompt] = await sql`
      SELECT id, name, prompt, negative_prompt, style_id
      FROM saved_prompts
      WHERE id = ${promptId} AND admin_id = ${session.adminId}
    `

    if (!prompt) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Промпт не найден' } },
        { status: 404 }
      )
    }

    console.log(`[GeneratePreview] Generating preview for prompt ${promptId}: "${prompt.name}"`)

    // Generate image using Kie.ai
    const referenceImages = referenceImageUrl ? [referenceImageUrl] : []

    const result = await generateWithKie({
      prompt: prompt.prompt,
      referenceImages,
      aspectRatio: '1:1', // Square for previews
      outputFormat: 'jpg'
    })

    if (!result.success || !result.url) {
      console.error(`[GeneratePreview] Failed to generate image:`, result.error)
      return NextResponse.json(
        { error: { code: 'GENERATION_FAILED', message: result.error || 'Ошибка генерации' } },
        { status: 500 }
      )
    }

    console.log(`[GeneratePreview] Generated image, uploading to R2...`)

    // Upload to R2 for permanent storage
    const r2Key = `previews/prompt-${promptId}-${Date.now()}.jpg`
    await uploadFromUrl(result.url, r2Key)
    const previewUrl = getPublicUrl(r2Key)

    // Update the prompt with preview URL
    await sql`
      UPDATE saved_prompts
      SET preview_url = ${previewUrl}
      WHERE id = ${promptId}
    `

    console.log(`[GeneratePreview] ✓ Preview generated for prompt ${promptId}`)

    return NextResponse.json({
      success: true,
      promptId,
      previewUrl,
      latencyMs: result.latencyMs
    })

  } catch (error) {
    console.error('[GeneratePreview] Error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'GENERATION_ERROR',
          message: error instanceof Error ? error.message : 'Ошибка генерации превью'
        }
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/prompts/generate-preview/batch
 * Generate preview images for multiple prompts
 *
 * Body: { promptIds: number[], referenceImageUrl?: string }
 */
