#!/usr/bin/env node
/**
 * Проверка фото конкретного пользователя
 */

import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const sql = neon(process.env.DATABASE_URL)

async function checkUser() {
  // Ищем пользователя по последним платежам 999₽
  console.log("=".repeat(70))
  console.log("  Поиск пользователя с проблемой (1 фото вместо 15)")
  console.log("=".repeat(70))

  // Проверяем последние платежи 999₽ (Standard tier = 15 фото)
  const recentPayments = await sql`
    SELECT
      p.*,
      u.id as user_id,
      u.telegram_user_id
    FROM payments p
    JOIN users u ON u.id = p.user_id
    WHERE p.status = 'succeeded'
    ORDER BY p.created_at DESC
    LIMIT 5
  `

  console.log("\n📦 Последние succeeded платежи:")
  for (const p of recentPayments) {
    console.log(`  Payment #${p.id} | ${p.amount}₽ | user_id=${p.user_id} | tg=${p.telegram_user_id}`)
  }

  // Проверяем каждого пользователя с succeeded платежом
  for (const payment of recentPayments) {
    console.log(`\n${"=".repeat(70)}`)
    console.log(`  ПОЛЬЗОВАТЕЛЬ: tg=${payment.telegram_user_id} (user_id=${payment.user_id})`)
    console.log(`${"=".repeat(70)}`)

    // Аватары пользователя
    const avatars = await sql`
      SELECT * FROM avatars
      WHERE user_id = ${payment.user_id}
      ORDER BY created_at DESC
    `

    console.log(`\n👤 Аватары (${avatars.length}):`)
    for (const a of avatars) {
      console.log(`  Avatar #${a.id} | status=${a.status} | name=${a.name}`)
    }

    // Generation jobs для каждого аватара
    for (const avatar of avatars) {
      const jobs = await sql`
        SELECT * FROM generation_jobs
        WHERE avatar_id = ${avatar.id}
        ORDER BY created_at DESC
      `

      console.log(`\n🎨 Jobs для avatar #${avatar.id} (${jobs.length}):`)
      for (const j of jobs) {
        console.log(`  Job #${j.id} | status=${j.status} | ${j.completed_photos}/${j.total_photos} photos`)
        if (j.error_message) {
          console.log(`       └─ ERROR: ${j.error_message}`)
        }

        // Kie tasks для этого job
        const tasks = await sql`
          SELECT status, COUNT(*) as count
          FROM kie_tasks
          WHERE job_id = ${j.id}
          GROUP BY status
        `
        console.log(`       └─ Kie tasks: ${tasks.map(t => `${t.status}=${t.count}`).join(', ')}`)

        // Детально смотрим failed tasks
        const failedTasks = await sql`
          SELECT * FROM kie_tasks
          WHERE job_id = ${j.id} AND status = 'failed'
        `
        if (failedTasks.length > 0) {
          console.log(`       └─ FAILED TASKS:`)
          for (const ft of failedTasks) {
            console.log(`          - prompt ${ft.prompt_index}: ${ft.error_message}`)
          }
        }
      }

      // Generated photos
      const photos = await sql`
        SELECT id, style_id, created_at, LEFT(image_url, 60) as url
        FROM generated_photos
        WHERE avatar_id = ${avatar.id}
        ORDER BY created_at DESC
      `

      console.log(`\n🖼️ Фото для avatar #${avatar.id} (${photos.length}):`)
      for (const p of photos) {
        const age = Math.round((Date.now() - new Date(p.created_at).getTime()) / 1000 / 60)
        console.log(`  Photo #${p.id} | ${p.style_id} | ${age} min ago`)
      }
    }
  }

  // Дополнительно: проверяем все jobs за сегодня
  console.log(`\n${"=".repeat(70)}`)
  console.log(`  ВСЕ JOBS ЗА ПОСЛЕДНИЕ 24 ЧАСА`)
  console.log(`${"=".repeat(70)}`)

  const allJobs = await sql`
    SELECT
      gj.*,
      a.user_id,
      u.telegram_user_id,
      (SELECT COUNT(*) FROM generated_photos WHERE avatar_id = gj.avatar_id) as actual_photos,
      (SELECT COUNT(*) FROM kie_tasks WHERE job_id = gj.id AND status = 'completed') as completed_tasks,
      (SELECT COUNT(*) FROM kie_tasks WHERE job_id = gj.id AND status = 'failed') as failed_tasks,
      (SELECT COUNT(*) FROM kie_tasks WHERE job_id = gj.id AND status = 'pending') as pending_tasks
    FROM generation_jobs gj
    JOIN avatars a ON a.id = gj.avatar_id
    JOIN users u ON u.id = a.user_id
    WHERE gj.created_at > NOW() - INTERVAL '24 hours'
    ORDER BY gj.created_at DESC
  `

  for (const j of allJobs) {
    const age = Math.round((Date.now() - new Date(j.created_at).getTime()) / 1000 / 60)
    console.log(`\nJob #${j.id} | tg=${j.telegram_user_id} | ${age} min ago`)
    console.log(`  Status: ${j.status}`)
    console.log(`  Target: ${j.total_photos} photos`)
    console.log(`  DB completed_photos: ${j.completed_photos}`)
    console.log(`  Actual photos in generated_photos: ${j.actual_photos}`)
    console.log(`  Kie tasks: ✅${j.completed_tasks} / ❌${j.failed_tasks} / ⏳${j.pending_tasks}`)
    if (j.error_message) {
      console.log(`  Error: ${j.error_message}`)
    }

    // Проверяем расхождение
    if (j.actual_photos != j.total_photos && j.status === 'completed') {
      console.log(`  ⚠️ ПРОБЛЕМА: Job completed но actual_photos (${j.actual_photos}) != total_photos (${j.total_photos})`)
    }
  }
}

checkUser().catch(console.error)
