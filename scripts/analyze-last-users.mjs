#!/usr/bin/env node
import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
const sql = neon(process.env.DATABASE_URL)

async function analyze() {
  console.log("=" .repeat(80))
  console.log("  ПОСЛЕДНИЕ 10 ПОЛЬЗОВАТЕЛЕЙ - ПОЛНЫЙ АНАЛИЗ")
  console.log("  " + new Date().toISOString())
  console.log("=" .repeat(80))

  // Get last 10 users with activity
  const users = await sql`
    SELECT DISTINCT ON (u.id)
      u.id,
      u.telegram_user_id,
      u.created_at,
      u.onboarding_completed_at,
      (SELECT COUNT(*) FROM avatars WHERE user_id = u.id) as avatar_count,
      (SELECT COUNT(*) FROM payments WHERE user_id = u.id AND status = 'succeeded') as successful_payments
    FROM users u
    WHERE u.telegram_user_id IS NOT NULL
    ORDER BY u.id DESC, u.created_at DESC
    LIMIT 10
  `

  for (let i = 0; i < users.length; i++) {
    const user = users[i]
    console.log("\n" + "━".repeat(80))
    console.log(`[${i + 1}/10] 👤 User #${user.id} | TG ID: ${user.telegram_user_id}`)
    console.log(`      Создан: ${user.created_at}`)
    console.log(`      Onboarding: ${user.onboarding_completed_at || 'НЕ ЗАВЕРШЁН'}`)
    console.log(`      Аватаров: ${user.avatar_count} | Успешных платежей: ${user.successful_payments}`)

    // ========== PAYMENTS ==========
    const payments = await sql`
      SELECT id, amount, status, tbank_payment_id, tier_id, photo_count, created_at, updated_at
      FROM payments
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    `

    if (payments.length > 0) {
      console.log(`\n   💳 ПЛАТЕЖИ (${payments.length}):`)
      for (const p of payments) {
        const age = Math.round((Date.now() - new Date(p.created_at).getTime()) / 1000 / 60)
        const tier = p.tier_id || 'N/A'
        const photos = p.photo_count || '?'
        console.log(`      #${p.id} | ${p.status.padEnd(10)} | ${p.amount}₽ | tier: ${tier} (${photos} фото) | ${age} min ago`)
        if (p.tbank_payment_id) {
          console.log(`           └─ T-Bank ID: ${p.tbank_payment_id}`)
        }
      }
    } else {
      console.log(`\n   💳 ПЛАТЕЖЕЙ НЕТ`)
    }

    // ========== AVATARS ==========
    const avatars = await sql`
      SELECT id, name, status, thumbnail_url, created_at, updated_at
      FROM avatars
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    `

    for (const avatar of avatars) {
      const avatarAge = Math.round((Date.now() - new Date(avatar.created_at).getTime()) / 1000 / 60)

      // Count photos
      const photoCount = await sql`
        SELECT COUNT(*) as cnt FROM generated_photos WHERE avatar_id = ${avatar.id}
      `.then(r => r[0].cnt)

      // Count reference photos
      const refPhotoCount = await sql`
        SELECT COUNT(*) as cnt FROM reference_photos WHERE avatar_id = ${avatar.id}
      `.then(r => r[0].cnt)

      console.log(`\n   🎭 AVATAR #${avatar.id} "${avatar.name}"`)
      console.log(`      Status: ${avatar.status} | Создан: ${avatarAge} min ago`)
      console.log(`      Референсных фото: ${refPhotoCount} | Сгенерировано: ${photoCount}`)
      if (avatar.thumbnail_url) {
        console.log(`      Thumbnail: ${avatar.thumbnail_url.substring(0, 60)}...`)
      }

      // ========== GENERATION JOBS ==========
      const jobs = await sql`
        SELECT id, style_id, status, total_photos, completed_photos, error_message, payment_id, created_at, updated_at
        FROM generation_jobs
        WHERE avatar_id = ${avatar.id}
        ORDER BY created_at DESC
      `

      if (jobs.length > 0) {
        console.log(`\n      📋 GENERATION JOBS (${jobs.length}):`)
        for (const job of jobs) {
          const jobAge = Math.round((Date.now() - new Date(job.created_at).getTime()) / 1000 / 60)
          const duration = Math.round((new Date(job.updated_at).getTime() - new Date(job.created_at).getTime()) / 1000 / 60)
          console.log(`         Job #${job.id} | ${job.status} | ${job.completed_photos}/${job.total_photos} | style: ${job.style_id}`)
          console.log(`         Создан: ${jobAge} min ago | Длительность: ${duration} min | Payment: ${job.payment_id || 'N/A'}`)

          if (job.error_message) {
            console.log(`         ❌ ERROR: ${job.error_message.substring(0, 80)}`)
          }

          // ========== KIE TASKS ==========
          const kieStats = await sql`
            SELECT
              status,
              COUNT(*) as cnt,
              AVG(attempts) as avg_attempts,
              MAX(error_message) as last_error
            FROM kie_tasks
            WHERE job_id = ${job.id}
            GROUP BY status
          `

          if (kieStats.length > 0) {
            const summary = kieStats.map(s =>
              `${s.status}:${s.cnt}(${Math.round(s.avg_attempts)}att)`
            ).join(', ')
            console.log(`         🔄 Kie tasks: ${summary}`)

            const failedStat = kieStats.find(s => s.status === 'failed')
            if (failedStat?.last_error) {
              console.log(`         ⚠️ Kie error: ${failedStat.last_error.substring(0, 70)}`)
            }
          }

          // Check for data loss issue
          const completedTasks = await sql`
            SELECT COUNT(*) as cnt
            FROM kie_tasks
            WHERE job_id = ${job.id} AND status = 'completed' AND result_url IS NOT NULL
          `.then(r => r[0].cnt)

          if (job.status === 'completed' && completedTasks > 0 && photoCount === 0) {
            console.log(`         🚨 DATA LOSS: Job completed with ${completedTasks} Kie tasks but 0 photos in DB!`)
          }
        }
      }

      // ========== UPLOADED & REFERENCE PHOTOS ==========
      const uploadedPhotos = await sql`
        SELECT id, image_url, created_at
        FROM uploaded_photos
        WHERE avatar_id = ${avatar.id}
        ORDER BY created_at
      `

      if (uploadedPhotos.length > 0) {
        console.log(`\n      📤 UPLOADED PHOTOS (${uploadedPhotos.length}):`)
        const first = uploadedPhotos[0]
        const last = uploadedPhotos[uploadedPhotos.length - 1]
        const uploadDuration = Math.round(
          (new Date(last.created_at).getTime() - new Date(first.created_at).getTime()) / 1000
        )
        console.log(`         Первое: ${first.created_at} | Последнее: ${last.created_at}`)
        console.log(`         Длительность загрузки: ${uploadDuration} сек`)
      }

      const refPhotos = await sql`
        SELECT id, image_url, created_at
        FROM reference_photos
        WHERE avatar_id = ${avatar.id}
        ORDER BY created_at
      `

      if (refPhotos.length > 0) {
        console.log(`\n      🔗 REFERENCE PHOTOS (используются для консистентности) (${refPhotos.length}):`)
        for (const rp of refPhotos) {
          console.log(`         #${rp.id} | ${rp.image_url.substring(0, 60)}... | ${rp.created_at}`)
        }
      }

      // ========== GENERATED PHOTOS ==========
      if (photoCount > 0) {
        const genPhotos = await sql`
          SELECT id, style_id, image_url, created_at, download_count, share_count
          FROM generated_photos
          WHERE avatar_id = ${avatar.id}
          ORDER BY created_at DESC
          LIMIT 5
        `

        console.log(`\n      🖼️ GENERATED PHOTOS (показаны первые 5 из ${photoCount}):`)
        for (const gp of genPhotos) {
          const age = Math.round((Date.now() - new Date(gp.created_at).getTime()) / 1000 / 60)
          console.log(`         #${gp.id} | style: ${gp.style_id} | ${age} min ago`)
          console.log(`              downloads: ${gp.download_count || 0} | shares: ${gp.share_count || 0}`)
          console.log(`              ${gp.image_url.substring(0, 70)}...`)
        }
      }
    }

    // ========== REFERRAL INFO ==========
    const referralInfo = await sql`
      SELECT
        (SELECT COUNT(*) FROM referrals WHERE referrer_id = ${user.id}) as referral_count,
        (SELECT COALESCE(SUM(amount), 0) FROM referral_earnings WHERE referrer_id = ${user.id}) as total_earned,
        (SELECT balance FROM referral_balances WHERE user_id = ${user.id}) as balance
    `

    const ri = referralInfo[0]
    if (ri.referral_count > 0) {
      console.log(`\n   👥 РЕФЕРАЛЫ:`)
      console.log(`      Приглашено: ${ri.referral_count} | Заработано: ${ri.total_earned}₽ | Баланс: ${ri.balance || 0}₽`)
    }

    // ========== TELEGRAM MESSAGE QUEUE ==========
    const telegramQueue = await sql`
      SELECT id, message_type, status, created_at, sent_at, attempts, error_message
      FROM telegram_message_queue
      WHERE telegram_chat_id = ${user.telegram_user_id}
      ORDER BY created_at DESC
      LIMIT 3
    `

    if (telegramQueue.length > 0) {
      console.log(`\n   📨 TELEGRAM MESSAGE QUEUE (последние 3):`)
      for (const msg of telegramQueue) {
        const age = Math.round((Date.now() - new Date(msg.created_at).getTime()) / 1000 / 60)
        const sent = msg.sent_at ? `sent ${Math.round((Date.now() - new Date(msg.sent_at).getTime()) / 1000 / 60)} min ago` : 'NOT SENT'
        console.log(`      #${msg.id} | ${msg.message_type} | ${msg.status} | attempts: ${msg.attempts} | ${sent} | created ${age} min ago`)
        if (msg.error_message) {
          console.log(`           └─ ERROR: ${msg.error_message.substring(0, 60)}`)
        }
      }
    }
  }

  console.log("\n" + "━".repeat(80))
  console.log("  ОБЩАЯ СТАТИСТИКА")
  console.log("━".repeat(80))

  // Global stats
  const globalStats = await sql`
    SELECT
      (SELECT COUNT(*) FROM users WHERE telegram_user_id IS NOT NULL) as total_users,
      (SELECT COUNT(*) FROM payments WHERE status = 'succeeded') as total_payments,
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'succeeded') as total_revenue,
      (SELECT COUNT(*) FROM generation_jobs WHERE status = 'completed') as completed_jobs,
      (SELECT COUNT(*) FROM generation_jobs WHERE status = 'failed') as failed_jobs,
      (SELECT COUNT(*) FROM generated_photos) as total_photos,
      (SELECT COUNT(*) FROM kie_tasks WHERE status = 'failed') as failed_kie_tasks
  `

  const gs = globalStats[0]
  console.log(`\n   👥 Всего пользователей: ${gs.total_users}`)
  console.log(`   💰 Успешных платежей: ${gs.total_payments} | Выручка: ${gs.total_revenue}₽`)
  console.log(`   ✅ Завершённых генераций: ${gs.completed_jobs}`)
  console.log(`   ❌ Проваленных генераций: ${gs.failed_jobs}`)
  console.log(`   🖼️ Всего сгенерировано фото: ${gs.total_photos}`)
  console.log(`   ⚠️ Failed Kie tasks: ${gs.failed_kie_tasks}`)

  console.log("\n" + "=".repeat(80))
  console.log("  АНАЛИЗ ЗАВЕРШЁН")
  console.log("=".repeat(80))
}

analyze().catch(console.error)
