export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createKieTask, checkKieTaskStatus } from "@/lib/kie"
import { getCurrentPartnerSession } from "@/lib/partner/session"
import { extractIdentifierFromRequest, findUserByIdentifier } from "@/lib/user-identity"
import type { TestResult } from "@/lib/admin/types"

/**
 * Helper to get authenticated partner user ID
 */
async function getPartnerUserId(request: NextRequest): Promise<number | null> {
  // Priority 1: Partner session cookie
  try {
    const sessionPromise = getCurrentPartnerSession()
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
    const session = await Promise.race([sessionPromise, timeoutPromise])
    if (session?.userId) {
      return session.userId
    }
  } catch (e) {
    console.error('[Partner Test Prompt] Session check error:', e)
  }

  // Priority 2: Query params (Telegram/Neon auth)
  const { searchParams } = new URL(request.url)
  const telegramUserId = searchParams.get('telegram_user_id')
  const neonUserId = searchParams.get('neon_auth_id') || searchParams.get('neon_user_id')

  if (telegramUserId || neonUserId) {
    const identifier = extractIdentifierFromRequest({
      telegram_user_id: telegramUserId,
      neon_auth_id: neonUserId
    })
    const basicUser = await findUserByIdentifier(identifier)
    if (basicUser) {
      return basicUser.id
    }
  }

  return null
}

interface TestPromptRequest {
  referenceImages: string[]
  prompt: string
  photoCount: 1 | 2 | 3 | 4
  aspectRatio?: '1:1' | '3:4' | '9:16'
}

/**
 * POST /api/partner/test-prompt
 *
 * Test prompt generation for partners via KIE AI
 * Same as admin/test-prompt but with quota checking
 */
export async function POST(request: NextRequest) {
  try {
    // ========================================================================
    // 1. AUTHENTICATION CHECK
    // ========================================================================
    const userId = await getPartnerUserId(request)

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: 'Authentication required',
            userMessage: 'Требуется авторизация',
            retryable: false,
          },
        },
        { status: 401 }
      )
    }

    // ========================================================================
    // 2. CHECK PARTNER STATUS AND QUOTA
    // ========================================================================
    const partnerCheck = await sql`
      SELECT 
        is_partner,
        test_generations_limit,
        test_generations_used
      FROM referral_balances 
      WHERE user_id = ${userId}
    `

    if (partnerCheck.length === 0 || !partnerCheck[0].is_partner) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: 'Partner status required',
            userMessage: 'Требуется статус партнёра',
            retryable: false,
          },
        },
        { status: 403 }
      )
    }

    const quota = partnerCheck[0]
    const limit = quota.test_generations_limit || 200
    const used = quota.test_generations_used || 0
    const remaining = limit - used

    // ========================================================================
    // 3. PARSE REQUEST BODY
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
    // 4. CHECK QUOTA BEFORE GENERATION
    // ========================================================================
    if (body.photoCount > remaining) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'QUOTA_EXCEEDED',
            message: `Quota exceeded. Remaining: ${remaining}, requested: ${body.photoCount}`,
            userMessage: `Недостаточно генераций. Осталось: ${remaining}, запрошено: ${body.photoCount}`,
            retryable: false,
          },
          quota: { limit, used, remaining }
        },
        { status: 429 }
      )
    }

    console.log(`[Partner Test Prompt] User ${userId} generating ${body.photoCount} photos. Quota: ${used}/${limit}`)

    // ========================================================================
    // 5. CREATE KIE TASKS
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

    console.log(`[Partner Test Prompt] Created ${taskIds.length} tasks:`, taskIds)

    // ========================================================================
    // 6. POLL FOR RESULTS (max 90s)
    // ========================================================================
    const MAX_WAIT_TIME = 90000
    const POLL_INTERVAL = 2000
    const startTime = Date.now()
    const results: TestResult[] = []
    const pendingTaskIds = [...taskIds]

    while (pendingTaskIds.length > 0 && Date.now() - startTime < MAX_WAIT_TIME) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))

      const statusChecks = await Promise.all(
        pendingTaskIds.map((taskId) => checkKieTaskStatus(taskId))
      )

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
          console.log(`[Partner Test Prompt] Task ${taskId} completed (${latency}ms)`)
        } else if (status.status === "failed") {
          console.error(`[Partner Test Prompt] Task ${taskId} failed:`, status.error)
          pendingTaskIds.splice(i, 1)
        }
      }
    }

    // ========================================================================
    // 7. UPDATE QUOTA (only for successful generations)
    // ========================================================================
    if (results.length > 0) {
      await sql`
        UPDATE referral_balances
        SET test_generations_used = test_generations_used + ${results.length}
        WHERE user_id = ${userId}
      `
      console.log(`[Partner Test Prompt] User ${userId} quota updated: +${results.length} generations`)
    }

    // ========================================================================
    // 8. RETURN RESULTS
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

    const newUsed = used + results.length
    const newRemaining = limit - newUsed

    console.log(`[Partner Test Prompt] Success: ${results.length} photos generated. New quota: ${newUsed}/${limit}`)

    return NextResponse.json({
      success: true,
      results,
      quota: {
        limit,
        used: newUsed,
        remaining: newRemaining
      }
    })

  } catch (error) {
    console.error('[Partner Test Prompt] Error:', error)

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
