// Cron Job: Poll pending Kie.ai tasks
// Runs every 10 seconds to check task status and download results
// This avoids Cloudflare 100s timeout by doing polling separately

export const maxDuration = 55 // Keep under Vercel's 60s cron limit

import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { checkKieTaskStatus } from "@/lib/kie"
import { uploadFromUrl, generatePromptKey, isR2Configured } from "@/lib/r2"
import { autoRefundForFailedGeneration } from "@/lib/tbank"

// Vercel cron requires GET
export async function GET() {
  const startTime = Date.now()
  console.log("[Poll Kie Tasks] Starting...")

  try {
    // Get pending tasks (limit to avoid timeout)
    const pendingTasks = await sql`
      SELECT kt.*, gj.style_id
      FROM kie_tasks kt
      JOIN generation_jobs gj ON gj.id = kt.job_id
      WHERE kt.status = 'pending'
      ORDER BY kt.created_at ASC
      LIMIT 10
    `

    if (pendingTasks.length === 0) {
      console.log("[Poll Kie Tasks] No pending tasks")
      return NextResponse.json({ success: true, processed: 0 })
    }

    console.log(`[Poll Kie Tasks] Found ${pendingTasks.length} pending tasks`)

    const useR2 = isR2Configured()
    let completed = 0
    let failed = 0
    let stillPending = 0

    for (const task of pendingTasks) {
      // Check if we're running out of time (leave 10s buffer)
      if (Date.now() - startTime > 45000) {
        console.log("[Poll Kie Tasks] Approaching timeout, stopping")
        break
      }

      console.log(`[Poll Kie Tasks] Checking task ${task.kie_task_id} (prompt ${task.prompt_index})`)

      const result = await checkKieTaskStatus(task.kie_task_id)

      if (result.status === "completed" && result.url) {
        // Upload to R2 if configured
        let finalImageUrl = result.url
        if (useR2) {
          try {
            const r2Key = generatePromptKey(
              task.avatar_id.toString(),
              task.style_id,
              task.prompt_index,
              "png"
            )
            const r2Result = await uploadFromUrl(result.url, r2Key)
            finalImageUrl = r2Result.url
          } catch (r2Error) {
            console.warn(`[Poll Kie Tasks] R2 upload failed:`, r2Error)
          }
        }

        // CRITICAL: Wrap DB operations in try/catch to prevent marking task as completed without saving photo
        try {
          // Save to generated_photos (with duplicate check)
          const existing = await sql`
            SELECT id FROM generated_photos
            WHERE avatar_id = ${task.avatar_id} AND style_id = ${task.style_id} AND prompt = ${task.prompt}
            LIMIT 1
          `.then((rows: any[]) => rows[0])

          if (!existing) {
            await sql`
              INSERT INTO generated_photos (avatar_id, style_id, prompt, image_url)
              VALUES (${task.avatar_id}, ${task.style_id}, ${task.prompt}, ${finalImageUrl})
            `
            console.log(`[Poll Kie Tasks] ✓ Saved photo to generated_photos for prompt ${task.prompt_index}`)
          }

          // Update task status ONLY after successful photo save
          await sql`
            UPDATE kie_tasks
            SET status = 'completed', result_url = ${finalImageUrl}, updated_at = NOW()
            WHERE id = ${task.id}
          `

          // Update job progress
          const actualCount = await sql`
            SELECT COUNT(*) as count FROM generated_photos
            WHERE avatar_id = ${task.avatar_id} AND style_id = ${task.style_id}
          `.then((rows: any[]) => parseInt(rows[0]?.count || '0'))

          await sql`
            UPDATE generation_jobs
            SET completed_photos = ${actualCount}, updated_at = NOW()
            WHERE id = ${task.job_id}
          `

          console.log(`[Poll Kie Tasks] ✓ Task ${task.kie_task_id} completed (photo ${actualCount}/${task.prompt_index + 1})`)
          completed++
        } catch (dbError) {
          // DB error - do NOT mark task as completed, retry on next cron
          console.error(`[Poll Kie Tasks] DB error for task ${task.kie_task_id}:`, dbError)
          // Increment attempts so we don't retry forever
          await sql`
            UPDATE kie_tasks
            SET attempts = attempts + 1, updated_at = NOW()
            WHERE id = ${task.id}
          `.catch(() => {})
          stillPending++
        }

      } else if (result.status === "failed") {
        await sql`
          UPDATE kie_tasks
          SET status = 'failed', error_message = ${result.error || 'Unknown error'}, updated_at = NOW()
          WHERE id = ${task.id}
        `
        console.log(`[Poll Kie Tasks] ✗ Task ${task.kie_task_id} failed: ${result.error}`)
        failed++

      } else {
        // Still pending/processing - increment attempts
        await sql`
          UPDATE kie_tasks
          SET attempts = attempts + 1, updated_at = NOW()
          WHERE id = ${task.id}
        `

        // Fail tasks that have been pending too long (5 minutes = 30 attempts at 10s interval)
        if (task.attempts >= 30) {
          await sql`
            UPDATE kie_tasks
            SET status = 'failed', error_message = 'Timeout after 5 minutes', updated_at = NOW()
            WHERE id = ${task.id}
          `
          console.log(`[Poll Kie Tasks] ✗ Task ${task.kie_task_id} timed out`)
          failed++
        } else {
          stillPending++
        }
      }
    }

    // Check if any jobs are now complete
    await checkJobCompletion()

    const elapsed = Date.now() - startTime
    console.log(`[Poll Kie Tasks] Done in ${elapsed}ms: ${completed} completed, ${failed} failed, ${stillPending} pending`)

    return NextResponse.json({
      success: true,
      processed: pendingTasks.length,
      completed,
      failed,
      stillPending,
      elapsedMs: elapsed,
    })

  } catch (error) {
    console.error("[Poll Kie Tasks] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// Check if any generation jobs are now complete
async function checkJobCompletion() {
  // Find jobs that are processing and have all tasks completed/failed
  const jobs = await sql`
    SELECT gj.id, gj.avatar_id, gj.total_photos,
           (SELECT COUNT(*) FROM kie_tasks WHERE job_id = gj.id AND status = 'completed') as completed_tasks,
           (SELECT COUNT(*) FROM kie_tasks WHERE job_id = gj.id AND status = 'failed') as failed_tasks,
           (SELECT COUNT(*) FROM kie_tasks WHERE job_id = gj.id AND status = 'pending') as pending_tasks,
           (SELECT COUNT(*) FROM kie_tasks WHERE job_id = gj.id) as total_tasks
    FROM generation_jobs gj
    WHERE gj.status = 'processing'
  `

  for (const job of jobs) {
    // Skip if not all tasks are created yet (chunk processing still ongoing)
    if (job.total_tasks < job.total_photos) {
      continue
    }

    // Skip if there are still pending tasks
    if (job.pending_tasks > 0) {
      continue
    }

    // All tasks are either completed or failed
    const failedPhotos = job.failed_tasks

    if (failedPhotos > 0) {
      console.log(`[Poll Kie Tasks] Job ${job.id}: ${failedPhotos}/${job.total_photos} photos failed - triggering refund`)

      // Get user for refund
      const avatarData = await sql`
        SELECT user_id FROM avatars WHERE id = ${job.avatar_id}
      `.then((rows: any[]) => rows[0])

      if (avatarData?.user_id) {
        const refundResult = await autoRefundForFailedGeneration(job.avatar_id, avatarData.user_id)
        console.log(`[Poll Kie Tasks] Auto-refund result:`, refundResult)
      }

      await sql`
        UPDATE generation_jobs
        SET status = 'failed',
            error_message = ${`${failedPhotos}/${job.total_photos} photos failed - payment refunded`},
            updated_at = NOW()
        WHERE id = ${job.id}
      `

      await sql`
        UPDATE avatars
        SET status = 'draft', updated_at = NOW()
        WHERE id = ${job.avatar_id}
      `

    } else {
      // All photos successful
      await sql`
        UPDATE generation_jobs
        SET status = 'completed', completed_photos = ${job.completed_tasks}, updated_at = NOW()
        WHERE id = ${job.id}
      `

      await sql`
        UPDATE avatars
        SET status = 'ready', updated_at = NOW()
        WHERE id = ${job.avatar_id}
      `

      console.log(`[Poll Kie Tasks] Job ${job.id} completed successfully - all ${job.total_photos} photos generated`)

      // Send photos to Telegram automatically
      await sendPhotosToTelegram(job.avatar_id)
    }
  }
}

// Send all generated photos to user's Telegram
// Also records messages to telegram_message_queue for admin panel visibility
async function sendPhotosToTelegram(avatarId: number) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

  if (!TELEGRAM_BOT_TOKEN) {
    console.log("[Poll Kie Tasks] Telegram bot not configured, skipping send")
    return
  }

  try {
    // Get avatar's user and their telegram_user_id
    const userData = await sql`
      SELECT u.telegram_user_id
      FROM avatars a
      JOIN users u ON u.id = a.user_id
      WHERE a.id = ${avatarId}
    `.then((rows: any[]) => rows[0])

    if (!userData?.telegram_user_id) {
      console.log(`[Poll Kie Tasks] No telegram_user_id for avatar ${avatarId}, skipping send`)
      return
    }

    const chatId = userData.telegram_user_id

    // Get all generated photos for this avatar
    const photos = await sql`
      SELECT image_url FROM generated_photos
      WHERE avatar_id = ${avatarId}
      ORDER BY created_at DESC
    `

    if (photos.length === 0) {
      console.log(`[Poll Kie Tasks] No photos found for avatar ${avatarId}`)
      return
    }

    const photoUrls = photos.map((p: any) => p.image_url)
    console.log(`[Poll Kie Tasks] Sending ${photoUrls.length} photos to Telegram user ${chatId}`)

    // Send photos in batches of 10 (Telegram limit)
    const batchSize = 10
    let sentCount = 0

    for (let i = 0; i < photoUrls.length; i += batchSize) {
      const batch = photoUrls.slice(i, i + batchSize)
      const isFirstBatch = i === 0
      const caption = isFirstBatch ? `✨ Ваши ${photoUrls.length} AI-портретов готовы!\n\nPinGlass` : undefined

      if (batch.length === 1) {
        // Single photo
        const photoUrl = batch[0]
        const response = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              photo: photoUrl,
              caption: caption
            })
          }
        )
        const result = await response.json()

        // Record to queue for admin visibility
        if (result.ok) {
          sentCount++
          await sql`
            INSERT INTO telegram_message_queue
            (telegram_chat_id, message_type, photo_url, caption, status, attempts, sent_at)
            VALUES (${chatId}, 'photo', ${photoUrl}, ${caption || null}, 'sent', 1, NOW())
          `
        } else {
          await sql`
            INSERT INTO telegram_message_queue
            (telegram_chat_id, message_type, photo_url, caption, status, attempts, error_message)
            VALUES (${chatId}, 'photo', ${photoUrl}, ${caption || null}, 'failed', 1, ${result.description || 'Unknown error'})
          `
        }
      } else {
        // Media group
        const media = batch.map((url: string, idx: number) => ({
          type: "photo",
          media: url,
          caption: isFirstBatch && idx === 0 ? caption : undefined
        }))

        const response = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, media })
          }
        )
        const result = await response.json()

        // Record each photo to queue for admin visibility
        for (let j = 0; j < batch.length; j++) {
          const photoUrl = batch[j]
          const photoCaption = isFirstBatch && j === 0 ? caption : null

          if (result.ok) {
            await sql`
              INSERT INTO telegram_message_queue
              (telegram_chat_id, message_type, photo_url, caption, status, attempts, sent_at)
              VALUES (${chatId}, 'photo', ${photoUrl}, ${photoCaption}, 'sent', 1, NOW())
            `
          } else {
            await sql`
              INSERT INTO telegram_message_queue
              (telegram_chat_id, message_type, photo_url, caption, status, attempts, error_message)
              VALUES (${chatId}, 'photo', ${photoUrl}, ${photoCaption}, 'failed', 1, ${result.description || 'Unknown error'})
            `
          }
        }

        if (result.ok) sentCount += batch.length
      }

      // Delay between batches
      if (i + batchSize < photoUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    console.log(`[Poll Kie Tasks] ✓ Sent ${sentCount}/${photoUrls.length} photos to Telegram (recorded to queue)`)

  } catch (error) {
    console.error("[Poll Kie Tasks] Failed to send photos to Telegram:", error)
  }
}
