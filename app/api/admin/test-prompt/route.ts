export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { createKieTask, checkKieTaskStatus } from "@/lib/kie"
import { getCurrentSession } from "@/lib/admin/session"
import type { TestPromptRequest, TestPromptResponse, TestResult } from "@/lib/admin/types"

/**
 * POST /api/admin/test-prompt
 *
 * Test prompt generation via KIE AI (Nano Banana Pro)
 *
 * Request Body:
 * {
 *   referenceImages: string[] // base64 or R2 URLs (5-10 images)
 *   prompt: string
 *   photoCount: 1 | 2 | 3 | 4
 *   aspectRatio?: "1:1" | "3:4" | "9:16"
 * }
 *
 * Response:
 * {
 *   success: boolean
 *   results?: TestResult[]
 *   error?: AdminError
 * }
 *
 * Architecture:
 * - Uses createKieTask() to avoid Cloudflare 100s timeout
 * - Polls checkKieTaskStatus() until all photos complete
 * - Max 90s total (stays under Cloudflare 100s limit)
 */
export async function POST(request: NextRequest) {
  try {
    // ========================================================================
    // 1. AUTHENTICATION CHECK
    // ========================================================================
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            userMessage: 'Требуется авторизация',
            retryable: false,
          },
        },
        { status: 401 }
      )
    }

    // ========================================================================
    // 2. PARSE REQUEST BODY
    // ========================================================================
    const body: TestPromptRequest = await request.json()

    // Validate required fields
    if (!body.prompt || !body.prompt.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Prompt is required',
            userMessage: 'Введите промпт',
            retryable: false,
          },
        },
        { status: 400 }
      )
    }

    if (!body.referenceImages || body.referenceImages.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Reference images are required',
            userMessage: 'Загрузите референсные изображения',
            retryable: false,
          },
        },
        { status: 400 }
      )
    }

    if (![1, 2, 3, 4].includes(body.photoCount)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Photo count must be 1-4',
            userMessage: 'Количество фото должно быть от 1 до 4',
            retryable: false,
          },
        },
        { status: 400 }
      )
    }

    // ========================================================================
    // 3. CREATE KIE TASKS (fire-and-forget)
    // ========================================================================
    const taskPromises = Array.from({ length: body.photoCount }).map(() =>
      createKieTask({
        prompt: body.prompt,
        referenceImages: body.referenceImages,
        aspectRatio: body.aspectRatio || "3:4",
        outputFormat: "jpg",
      })
    )

    const createdTasks = await Promise.all(taskPromises)

    // Check if any task creation failed
    const failedTasks = createdTasks.filter((t) => !t.success)
    if (failedTasks.length > 0) {
      const firstError = failedTasks[0]
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'KIE_API_ERROR',
            message: firstError.error || 'Task creation failed',
            userMessage: 'Не удалось создать задачи генерации. Попробуйте снова.',
            retryable: true,
          },
        },
        { status: 500 }
      )
    }

    const taskIds = createdTasks
      .filter((t) => t.taskId)
      .map((t) => t.taskId as string)

    // ========================================================================
    // 4. POLL FOR RESULTS (max 90s to stay under Cloudflare 100s limit)
    // ========================================================================
    const MAX_WAIT_TIME = 90000 // 90 seconds
    const POLL_INTERVAL = 2000   // Poll every 2 seconds
    const startTime = Date.now()
    const results: TestResult[] = []
    const pendingTaskIds = [...taskIds]

    while (pendingTaskIds.length > 0 && Date.now() - startTime < MAX_WAIT_TIME) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))

      // Check all pending tasks
      const statusChecks = await Promise.all(
        pendingTaskIds.map((taskId) => checkKieTaskStatus(taskId))
      )

      // Process completed/failed tasks
      for (let i = pendingTaskIds.length - 1; i >= 0; i--) {
        const taskId = pendingTaskIds[i]
        const status = statusChecks[i]

        if (status.status === "completed" && status.url) {
          const latency = Date.now() - startTime
          results.push({
            imageUrl: status.url,
            latency,
            taskId,
            aspectRatio: body.aspectRatio || "3:4",
          })
          pendingTaskIds.splice(i, 1)
        } else if (status.status === "failed") {
          pendingTaskIds.splice(i, 1)
        }
      }
    }

    // ========================================================================
    // 5. RETURN RESULTS
    // ========================================================================
    if (results.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'KIE_TIMEOUT',
            message: 'Generation timeout (90s)',
            userMessage: 'Генерация заняла слишком много времени. Попробуйте снова.',
            retryable: true,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      results,
    })

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'KIE_API_ERROR',
          message: errorMsg,
          userMessage: 'Ошибка генерации. Проверьте промпт и попробуйте снова.',
          retryable: true,
        },
      },
      { status: 500 }
    )
  }
}
