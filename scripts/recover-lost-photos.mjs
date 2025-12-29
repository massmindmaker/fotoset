#!/usr/bin/env node
/**
 * Восстановление потерянных фото из kie_tasks
 *
 * Находит completed kie_tasks у которых есть result_url,
 * но нет соответствующей записи в generated_photos
 */

import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const sql = neon(process.env.DATABASE_URL)

async function recover() {
  console.log("=".repeat(70))
  console.log("  ВОССТАНОВЛЕНИЕ ПОТЕРЯННЫХ ФОТО")
  console.log("=".repeat(70))

  // Найти все completed tasks с result_url
  const tasksWithPhotos = await sql`
    SELECT kt.*, gj.style_id
    FROM kie_tasks kt
    JOIN generation_jobs gj ON gj.id = kt.job_id
    WHERE kt.status = 'completed'
      AND kt.result_url IS NOT NULL
    ORDER BY kt.job_id, kt.prompt_index
  `

  console.log(`\nНайдено ${tasksWithPhotos.length} completed tasks с result_url`)

  let recovered = 0
  let alreadyExists = 0
  let errors = 0

  for (const task of tasksWithPhotos) {
    // Проверяем есть ли фото в generated_photos
    const existing = await sql`
      SELECT id FROM generated_photos
      WHERE avatar_id = ${task.avatar_id}
        AND style_id = ${task.style_id}
        AND prompt = ${task.prompt}
      LIMIT 1
    `.then(rows => rows[0])

    if (existing) {
      alreadyExists++
      continue
    }

    // Фото отсутствует - восстанавливаем
    console.log(`\n⚠️ Отсутствует фото для job=${task.job_id}, prompt=${task.prompt_index}`)
    console.log(`   URL: ${task.result_url.substring(0, 60)}...`)

    try {
      const result = await sql`
        INSERT INTO generated_photos (avatar_id, style_id, prompt, image_url)
        VALUES (${task.avatar_id}, ${task.style_id}, ${task.prompt}, ${task.result_url})
        RETURNING id
      `
      console.log(`   ✅ Восстановлено: photo #${result[0].id}`)
      recovered++
    } catch (err) {
      console.log(`   ❌ Ошибка: ${err.message}`)
      errors++
    }
  }

  console.log("\n" + "=".repeat(70))
  console.log("  РЕЗУЛЬТАТ")
  console.log("=".repeat(70))
  console.log(`  Всего tasks проверено: ${tasksWithPhotos.length}`)
  console.log(`  Уже существует: ${alreadyExists}`)
  console.log(`  Восстановлено: ${recovered}`)
  console.log(`  Ошибок: ${errors}`)
  console.log("=".repeat(70))

  // Обновить completed_photos для affected jobs
  if (recovered > 0) {
    console.log("\nОбновление счётчиков jobs...")

    const affectedJobs = await sql`
      SELECT DISTINCT job_id FROM kie_tasks
      WHERE status = 'completed' AND result_url IS NOT NULL
    `

    for (const { job_id } of affectedJobs) {
      const job = await sql`SELECT avatar_id, style_id FROM generation_jobs WHERE id = ${job_id}`.then(r => r[0])
      if (!job) continue

      const actualCount = await sql`
        SELECT COUNT(*) as count FROM generated_photos
        WHERE avatar_id = ${job.avatar_id} AND style_id = ${job.style_id}
      `.then(r => parseInt(r[0]?.count || '0'))

      await sql`
        UPDATE generation_jobs
        SET completed_photos = ${actualCount}, updated_at = NOW()
        WHERE id = ${job_id}
      `
      console.log(`  Job #${job_id}: completed_photos = ${actualCount}`)
    }
  }
}

recover().catch(console.error)
