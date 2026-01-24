import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAuthenticatedUser } from "@/lib/auth-middleware"
import { createKieTask, checkKieTaskStatus } from "@/lib/kie"
import type { TestPromptRequest, TestResult } from "@/lib/admin/types"

/**
 * POST /api/partner/test-prompt
 *
 * Test prompt generation for partners via KIE AI
 * Requires partner status
 */
export async function POST(request: NextRequest) {
  try {
    // ========================================================================
    // 1. AUTHENTICATION CHECK
    // ========================================================================
    const body: TestPromptRequest = await request.json()
    const authUser = await getAuthenticatedUser(request, body)

    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          message: "Authentication required",
        },
        { status: 401 }
      )
    }

    // Check if user is a partner
    const partnerCheck = await sql`
      SELECT is_partner FROM referral_balances WHERE user_id = ${authUser.user.id}
    `

    if (partnerCheck.length === 0 || !partnerCheck[0].is_partner) {
      return NextResponse.json(
        {
          success: false,
          error: "FORBIDDEN",
          message: "Partner status required",
        },
        { status: 403 }
      )
    }

    // ========================================================================
    // 2. VALIDATE REQUEST
    // ========================================================================
    if (!body.prompt || !body.prompt.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_INPUT", userMessage: "Введите промпт" },
        },
        { status: 400 }
      )
    }

    if (!body.referenceImages || body.referenceImages.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_INPUT", userMessage: "Загрузите референсные изображения" },
        },
        { status: 400 }
      )
    }

    if (![1, 2, 3, 4].includes(body.photoCount)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_INPUT", userMessage: "Количество фото должно быть от 1 до 4" },
        },
        { status: 400 }
      )
    }

    console.log(`[Partner Test Prompt] User ${authUser.user.id} generating ${body.photoCount} photos`)

    // ========================================================================
    // 3. CREATE KIE TASKS
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

    const failedTasks = createdTasks.filter((t) => !t.success)
    if (failedTasks.length > 0) {
      const firstError = failedTasks[0]
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "KIE_API_ERROR",
            userMessage: "Не удалось создать задачи генерации. Попробуйте снова.",
          },
        },
        { status: 500 }
      )
    }

    const taskIds = createdTasks
      .filter((t) => t.taskId)
      .map((t) => t.taskId as string)

    console.log(`[Partner Test Prompt] Created ${taskIds.length} tasks`)

    // ========================================================================
    // 4. POLL FOR RESULTS (max 90s)
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
            code: "KIE_TIMEOUT",
            userMessage: "Генерация заняла слишком много времени. Попробуйте снова.",
          },
        },
        { status: 500 }
      )
    }

    console.log(`[Partner Test Prompt] Success: ${results.length} photos generated`)

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error) {
    console.error("[Partner Test Prompt] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "KIE_API_ERROR",
          userMessage: "Ошибка генерации. Попробуйте снова.",
        },
      },
      { status: 500 }
    )
  }
}
