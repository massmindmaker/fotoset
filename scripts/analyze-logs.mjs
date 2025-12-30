#!/usr/bin/env node
/**
 * Анализ последних платежей и генераций PinGlass
 */

import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const sql = neon(process.env.DATABASE_URL)

async function analyze() {
  console.log("=" .repeat(70))
  console.log("  PINGLASS - Анализ логов платежей и генераций")
  console.log("  " + new Date().toISOString())
  console.log("=" .repeat(70))

  // 1. Последние платежи
  console.log("\n📦 ПОСЛЕДНИЕ ПЛАТЕЖИ (10 записей)")
  console.log("-".repeat(70))

  const payments = await sql`
    SELECT
      p.id,
      p.tbank_payment_id,
      p.amount,
      p.status,
      p.created_at,
      p.updated_at,
      u.telegram_user_id
    FROM payments p
    LEFT JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC
    LIMIT 10
  `

  if (payments.length === 0) {
    console.log("  Нет платежей")
  } else {
    for (const p of payments) {
      const age = Math.round((Date.now() - new Date(p.created_at).getTime()) / 1000 / 60)
      console.log(`  #${p.id} | ${p.status.padEnd(10)} | ${p.amount}₽ | tg: ${p.telegram_user_id} | ${age} min ago`)
      if (p.tbank_payment_id) {
        console.log(`       └─ tbank_id: ${p.tbank_payment_id}`)
      }
    }
  }

  // 2. Последние generation jobs
  console.log("\n🎨 ПОСЛЕДНИЕ GENERATION JOBS (10 записей)")
  console.log("-".repeat(70))

  const jobs = await sql`
    SELECT
      gj.id,
      gj.avatar_id,
      gj.style_id,
      gj.status,
      gj.total_photos,
      gj.completed_photos,
      gj.error_message,
      gj.created_at,
      gj.updated_at,
      gj.payment_id,
      a.name as avatar_name,
      u.telegram_user_id
    FROM generation_jobs gj
    LEFT JOIN avatars a ON a.id = gj.avatar_id
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY gj.created_at DESC
    LIMIT 10
  `

  if (jobs.length === 0) {
    console.log("  Нет generation jobs")
  } else {
    for (const j of jobs) {
      const age = Math.round((Date.now() - new Date(j.created_at).getTime()) / 1000 / 60)
      const progress = `${j.completed_photos}/${j.total_photos}`
      console.log(`  Job #${j.id} | ${j.status.padEnd(10)} | ${progress.padEnd(5)} | style: ${j.style_id || 'N/A'} | tg: ${j.telegram_user_id} | ${age} min ago`)
      if (j.error_message) {
        console.log(`       └─ ERROR: ${j.error_message.substring(0, 60)}...`)
      }
      if (j.payment_id) {
        console.log(`       └─ payment_id: ${j.payment_id}`)
      }
    }
  }

  // 3. Kie Tasks статистика
  console.log("\n🔄 KIE TASKS СТАТИСТИКА")
  console.log("-".repeat(70))

  const taskStats = await sql`
    SELECT
      status,
      COUNT(*) as count,
      AVG(attempts) as avg_attempts
    FROM kie_tasks
    GROUP BY status
    ORDER BY status
  `

  for (const s of taskStats) {
    console.log(`  ${s.status.padEnd(12)}: ${s.count} tasks (avg attempts: ${Math.round(s.avg_attempts || 0)})`)
  }

  // 4. Последние Kie Tasks
  console.log("\n📋 ПОСЛЕДНИЕ KIE TASKS (15 записей)")
  console.log("-".repeat(70))

  const kieTasks = await sql`
    SELECT
      kt.id,
      kt.job_id,
      kt.kie_task_id,
      kt.prompt_index,
      kt.status,
      kt.attempts,
      kt.error_message,
      kt.created_at,
      kt.updated_at
    FROM kie_tasks kt
    ORDER BY kt.created_at DESC
    LIMIT 15
  `

  if (kieTasks.length === 0) {
    console.log("  Нет Kie tasks")
  } else {
    for (const t of kieTasks) {
      const age = Math.round((Date.now() - new Date(t.created_at).getTime()) / 1000 / 60)
      console.log(`  Task #${t.id} | job=${t.job_id} | prompt=${t.prompt_index} | ${t.status.padEnd(10)} | attempts=${t.attempts} | ${age} min ago`)
      if (t.error_message) {
        console.log(`       └─ ERROR: ${t.error_message.substring(0, 50)}...`)
      }
      if (t.kie_task_id && t.kie_task_id.length > 10) {
        console.log(`       └─ kie_id: ${t.kie_task_id.substring(0, 20)}...`)
      }
    }
  }

  // 5. Generated Photos
  console.log("\n🖼️ GENERATED PHOTOS (последние 10)")
  console.log("-".repeat(70))

  const photos = await sql`
    SELECT
      gp.id,
      gp.avatar_id,
      gp.style_id,
      gp.created_at,
      LEFT(gp.image_url, 50) as url_preview
    FROM generated_photos gp
    ORDER BY gp.created_at DESC
    LIMIT 10
  `

  if (photos.length === 0) {
    console.log("  Нет сгенерированных фото")
  } else {
    for (const p of photos) {
      const age = Math.round((Date.now() - new Date(p.created_at).getTime()) / 1000 / 60)
      console.log(`  Photo #${p.id} | avatar=${p.avatar_id} | style=${p.style_id} | ${age} min ago`)
      console.log(`       └─ ${p.url_preview}...`)
    }
  }

  // 6. Referral статистика
  console.log("\n👥 REFERRAL СТАТИСТИКА")
  console.log("-".repeat(70))

  const referralStats = await sql`
    SELECT
      (SELECT COUNT(*) FROM referrals) as total_referrals,
      (SELECT COUNT(*) FROM referral_earnings) as total_earnings,
      (SELECT COALESCE(SUM(amount), 0) FROM referral_earnings) as total_earned,
      (SELECT COALESCE(SUM(balance), 0) FROM referral_balances) as total_balance
  `

  const rs = referralStats[0]
  console.log(`  Всего рефералов: ${rs.total_referrals}`)
  console.log(`  Начислений: ${rs.total_earnings}`)
  console.log(`  Общая сумма earned: ${rs.total_earned}₽`)
  console.log(`  Общий balance: ${rs.total_balance}₽`)

  // 7. Последние referral earnings
  console.log("\n💰 ПОСЛЕДНИЕ REFERRAL EARNINGS")
  console.log("-".repeat(70))

  const earnings = await sql`
    SELECT
      re.id,
      re.referrer_id,
      re.referred_id,
      re.amount,
      re.original_amount,
      re.created_at,
      u.telegram_user_id as referrer_tg
    FROM referral_earnings re
    LEFT JOIN users u ON u.id = re.referrer_id
    ORDER BY re.created_at DESC
    LIMIT 5
  `

  if (earnings.length === 0) {
    console.log("  Нет earnings")
  } else {
    for (const e of earnings) {
      const age = Math.round((Date.now() - new Date(e.created_at).getTime()) / 1000 / 60)
      console.log(`  Earning #${e.id} | ${e.amount}₽ (10% от ${e.original_amount}₽) | referrer tg: ${e.referrer_tg} | ${age} min ago`)
    }
  }

  // 8. Pending/Processing jobs детали
  console.log("\n⏳ АКТИВНЫЕ JOBS (pending/processing)")
  console.log("-".repeat(70))

  const activeJobs = await sql`
    SELECT
      gj.*,
      (SELECT COUNT(*) FROM kie_tasks WHERE job_id = gj.id AND status = 'pending') as pending_tasks,
      (SELECT COUNT(*) FROM kie_tasks WHERE job_id = gj.id AND status = 'completed') as completed_tasks,
      (SELECT COUNT(*) FROM kie_tasks WHERE job_id = gj.id AND status = 'failed') as failed_tasks,
      (SELECT COUNT(*) FROM kie_tasks WHERE job_id = gj.id) as total_tasks
    FROM generation_jobs gj
    WHERE gj.status IN ('pending', 'processing')
    ORDER BY gj.created_at DESC
  `

  if (activeJobs.length === 0) {
    console.log("  Нет активных jobs")
  } else {
    for (const j of activeJobs) {
      const age = Math.round((Date.now() - new Date(j.created_at).getTime()) / 1000 / 60)
      console.log(`  Job #${j.id} [${j.status}] | ${age} min ago`)
      console.log(`       └─ Tasks: ${j.completed_tasks}✅ / ${j.pending_tasks}⏳ / ${j.failed_tasks}❌ (total: ${j.total_tasks}/${j.total_photos})`)
    }
  }

  // 9. Failed jobs за последние 24 часа
  console.log("\n❌ FAILED JOBS (последние 24 часа)")
  console.log("-".repeat(70))

  const failedJobs = await sql`
    SELECT
      gj.id,
      gj.avatar_id,
      gj.status,
      gj.total_photos,
      gj.completed_photos,
      gj.error_message,
      gj.created_at,
      u.telegram_user_id
    FROM generation_jobs gj
    LEFT JOIN avatars a ON a.id = gj.avatar_id
    LEFT JOIN users u ON u.id = a.user_id
    WHERE gj.status = 'failed'
      AND gj.created_at > NOW() - INTERVAL '24 hours'
    ORDER BY gj.created_at DESC
  `

  if (failedJobs.length === 0) {
    console.log("  Нет failed jobs за последние 24 часа ✅")
  } else {
    for (const j of failedJobs) {
      const age = Math.round((Date.now() - new Date(j.created_at).getTime()) / 1000 / 60)
      console.log(`  Job #${j.id} | ${j.completed_photos}/${j.total_photos} photos | tg: ${j.telegram_user_id} | ${age} min ago`)
      if (j.error_message) {
        console.log(`       └─ ${j.error_message}`)
      }
    }
  }

  // 10. Refunded payments
  console.log("\n🔄 REFUNDED PAYMENTS (последние 10)")
  console.log("-".repeat(70))

  const refunded = await sql`
    SELECT
      p.id,
      p.amount,
      p.tbank_payment_id,
      p.created_at,
      p.updated_at,
      u.telegram_user_id
    FROM payments p
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.status = 'refunded'
    ORDER BY p.updated_at DESC
    LIMIT 10
  `

  if (refunded.length === 0) {
    console.log("  Нет refunded платежей")
  } else {
    for (const r of refunded) {
      const age = Math.round((Date.now() - new Date(r.updated_at).getTime()) / 1000 / 60)
      console.log(`  Payment #${r.id} | ${r.amount}₽ | tg: ${r.telegram_user_id} | refunded ${age} min ago`)
    }
  }

  console.log("\n" + "=".repeat(70))
  console.log("  Анализ завершён")
  console.log("=".repeat(70))
}

analyze().catch(console.error)
