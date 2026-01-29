import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
import { generateWithKie, isKieConfigured } from '@/lib/kie'
import { uploadFromUrl, getPublicUrl, isR2Configured } from '@/lib/r2'

// Increase timeout for batch Kie.ai generation (can take several minutes)
export const maxDuration = 300
/**
 * POST /api/admin/prompts/generate-preview/batch
 * Generate preview images for multiple prompts (batch mode)
 *
 * Body: { promptIds?: number[], referenceImageUrl?: string, all?: boolean }
 * - promptIds: specific prompt IDs to generate previews for
 * - referenceImageUrl: optional reference image URL for generation
 * - all: if true, generate for all prompts without preview_url
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
    const { promptIds, referenceImageUrl, all } = body
    // Get prompts to process
    let prompts: any[]
    if (all) {
      // Get all prompts without preview_url
      prompts = await sql`
        SELECT id, name, prompt, negative_prompt, style_id
        FROM saved_prompts
        WHERE admin_id = ${session.adminId}
          AND (preview_url IS NULL OR preview_url = '')
        ORDER BY id
      `
    } else if (promptIds && promptIds.length > 0) {
      prompts = await sql`
        SELECT id, name, prompt, negative_prompt, style_id
        FROM saved_prompts
        WHERE id = ANY(${promptIds})
          AND admin_id = ${session.adminId}
        ORDER BY id
      `
    } else {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'Укажите promptIds или all: true' } },
        { status: 400 }
      )
    }

    if (prompts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Нет промптов для генерации превью',
        generated: 0,
        failed: 0,
        results: []
      })
    }

    console.log(`[BatchPreview] Starting batch generation for ${prompts.length} prompts`)

    const results: Array<{
      promptId: number
      name: string
      success: boolean
      previewUrl?: string
      error?: string
    }> = []

    let generated = 0
    let failed = 0

    // Process prompts sequentially to avoid rate limits
    for (const prompt of prompts) {
      try {
        console.log(`[BatchPreview] Generating preview for prompt ${prompt.id}: "${prompt.name}"`)

        const referenceImages = referenceImageUrl ? [referenceImageUrl] : []

        const result = await generateWithKie({
          prompt: prompt.prompt,
          referenceImages,
          aspectRatio: '1:1',
          outputFormat: 'jpg'
        })

        if (!result.success || !result.url) {
          throw new Error(result.error || 'Generation failed')
        }

        // Upload to R2
        const r2Key = `previews/prompt-${prompt.id}-${Date.now()}.jpg`
        await uploadFromUrl(result.url, r2Key)
        const previewUrl = getPublicUrl(r2Key)

        // Update prompt
        await sql`
          UPDATE saved_prompts
          SET preview_url = ${previewUrl}
          WHERE id = ${prompt.id}
        `

        results.push({
          promptId: prompt.id,
          name: prompt.name,
          success: true,
          previewUrl
        })
        generated++

        console.log(`[BatchPreview] ✓ Preview generated for prompt ${prompt.id}`)

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[BatchPreview] ✗ Failed prompt ${prompt.id}:`, errorMessage)

        results.push({
          promptId: prompt.id,
          name: prompt.name,
          success: false,
          error: errorMessage
        })
        failed++
      }
    }

    console.log(`[BatchPreview] Completed: ${generated} generated, ${failed} failed`)

    return NextResponse.json({
      success: true,
      message: `Сгенерировано ${generated} из ${prompts.length} превью`,
      generated,
      failed,
      total: prompts.length,
      results
    })

  } catch (error) {
    console.error('[BatchPreview] Error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'BATCH_ERROR',
          message: error instanceof Error ? error.message : 'Ошибка батч-генерации'
        }
      },
      { status: 500 }
    )
  }
}
