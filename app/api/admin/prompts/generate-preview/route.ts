import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
import { createKieTask, isKieConfigured } from '@/lib/kie'
import { isR2Configured } from '@/lib/r2'

// Keep under Vercel timeout - we use async task creation
export const maxDuration = 55
/**
 * POST /api/admin/prompts/generate-preview
 * Start async preview generation for a saved prompt using Kie.ai
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

    console.log(`[GeneratePreview] Starting async generation for prompt ${promptId}: "${prompt.name}"`)

    // Create async Kie task
    const referenceImages = referenceImageUrl ? [referenceImageUrl] : []

    const result = await createKieTask({
      prompt: prompt.prompt,
      referenceImages,
      aspectRatio: '1:1', // Square for previews
      outputFormat: 'jpg'
    })

    if (!result.success || !result.taskId) {
      console.error(`[GeneratePreview] Failed to create task:`, result.error)
      return NextResponse.json(
        { error: { code: 'TASK_CREATION_FAILED', message: result.error || 'Ошибка создания задачи' } },
        { status: 500 }
      )
    }

    // Store task in preview_tasks table for polling
    await sql`
      INSERT INTO preview_tasks (prompt_id, kie_task_id, status, created_at)
      VALUES (${promptId}, ${result.taskId}, 'pending', NOW())
      ON CONFLICT (prompt_id)
      DO UPDATE SET kie_task_id = ${result.taskId}, status = 'pending', created_at = NOW(), error_message = NULL
    `

    console.log(`[GeneratePreview] ✓ Task created for prompt ${promptId}: ${result.taskId}`)

    return NextResponse.json({
      success: true,
      promptId,
      taskId: result.taskId,
      message: 'Генерация запущена. Превью появится автоматически.'
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
 * GET /api/admin/prompts/generate-preview?promptId=123
 * Check preview generation status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const promptId = searchParams.get('promptId')

    if (!promptId) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'promptId обязателен' } },
        { status: 400 }
      )
    }
    const [task] = await sql`
      SELECT pt.*, sp.preview_url
      FROM preview_tasks pt
      JOIN saved_prompts sp ON sp.id = pt.prompt_id
      WHERE pt.prompt_id = ${promptId}
    `

    if (!task) {
      return NextResponse.json({
        status: 'none',
        message: 'Нет активных задач'
      })
    }

    return NextResponse.json({
      status: task.status,
      taskId: task.kie_task_id,
      previewUrl: task.preview_url,
      error: task.error_message
    })

  } catch (error) {
    console.error('[GeneratePreview] Status check error:', error)
    return NextResponse.json(
      { error: { code: 'STATUS_ERROR', message: 'Ошибка проверки статуса' } },
      { status: 500 }
    )
  }
}
