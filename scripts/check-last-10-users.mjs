#!/usr/bin/env node
import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
const sql = neon(process.env.DATABASE_URL)

async function analyze() {
  console.log("=" .repeat(70))
  console.log("  ПОСЛЕДНИЕ 10 ПОЛЬЗОВАТЕЛЕЙ - ДЕТАЛЬНЫЙ АНАЛИЗ")
  console.log("=" .repeat(70))

  // Get last 10 users by their most recent activity
  const users = await sql`
    SELECT DISTINCT ON (u.id)
      u.id,
      u.telegram_user_id,
      u.is_pro,
      u.created_at,
      (SELECT COUNT(*) FROM avatars WHERE user_id = u.id) as avatar_count,
      (SELECT MAX(created_at) FROM payments WHERE user_id = u.id) as last_payment,
      (SELECT status FROM payments WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as last_payment_status
    FROM users u
    WHERE u.telegram_user_id IS NOT NULL
    ORDER BY u.id DESC, u.created_at DESC
    LIMIT 10
  `

  for (const user of users) {
    console.log("\n" + "─".repeat(70))
    console.log(`👤 User #${user.id} | TG: ${user.telegram_user_id} | Pro: ${user.is_pro}`)
    console.log(`   Создан: ${user.created_at} | Аватаров: ${user.avatar_count}`)
    
    // Payments
    const payments = await sql`
      SELECT id, amount, status, tbank_payment_id, created_at
      FROM payments
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    `
    
    if (payments.length > 0) {
      console.log(`\n   💳 Платежи (${payments.length}):`)
      for (const p of payments) {
        const age = Math.round((Date.now() - new Date(p.created_at).getTime()) / 1000 / 60)
        console.log(`      #${p.id} | ${p.status.padEnd(10)} | ${p.amount}₽ | ${age} min ago`)
      }
    }

    // Avatars and their jobs
    const avatars = await sql`
      SELECT id, name, status, created_at
      FROM avatars
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    `

    for (const avatar of avatars) {
      const photoCount = await sql`
        SELECT COUNT(*) as cnt FROM generated_photos WHERE avatar_id = ${avatar.id}
      `.then(r => r[0].cnt)

      console.log(`\n   🎭 Avatar #${avatar.id} "${avatar.name}" | status: ${avatar.status} | photos: ${photoCount}`)
      
      const jobs = await sql`
        SELECT id, status, total_photos, completed_photos, error_message, created_at
        FROM generation_jobs
        WHERE avatar_id = ${avatar.id}
        ORDER BY created_at DESC
      `

      if (jobs.length > 0) {
        for (const job of jobs) {
          const age = Math.round((Date.now() - new Date(job.created_at).getTime()) / 1000 / 60)
          console.log(`      📋 Job #${job.id} | ${job.status} | ${job.completed_photos}/${job.total_photos} | ${age} min ago`)
          
          if (job.error_message) {
            console.log(`         ❌ Error: ${job.error_message.substring(0, 60)}`)
          }

          // Check kie_tasks for this job
          const kieTasks = await sql`
            SELECT status, COUNT(*) as cnt, MAX(error_message) as last_error
            FROM kie_tasks
            WHERE job_id = ${job.id}
            GROUP BY status
          `

          if (kieTasks.length > 0) {
            const taskSummary = kieTasks.map(t => `${t.status}:${t.cnt}`).join(', ')
            console.log(`         🔄 Kie tasks: ${taskSummary}`)
            
            const failedTask = kieTasks.find(t => t.status === 'failed')
            if (failedTask?.last_error) {
              console.log(`         ⚠️ Kie error: ${failedTask.last_error.substring(0, 50)}`)
            }
          }
        }
      }
    }

    // Check referral info
    const referralInfo = await sql`
      SELECT 
        (SELECT COUNT(*) FROM referrals WHERE referrer_id = ${user.id}) as referral_count,
        (SELECT COALESCE(SUM(amount), 0) FROM referral_earnings WHERE referrer_id = ${user.id}) as total_earned
    `

    if (referralInfo[0].referral_count > 0) {
      console.log(`\n   👥 Рефералов: ${referralInfo[0].referral_count} | Earned: ${referralInfo[0].total_earned}₽`)
    }
  }

  console.log("\n" + "=".repeat(70))
}

analyze().catch(console.error)
