#!/usr/bin/env node
/**
 * Детальная проверка Job #34
 */

import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const sql = neon(process.env.DATABASE_URL)

async function check() {
  console.log("=".repeat(70))
  console.log("  ДЕТАЛЬНЫЙ АНАЛИЗ JOB #34")
  console.log("=".repeat(70))

  // Job info
  const job = await sql`SELECT * FROM generation_jobs WHERE id = 34`.then(r => r[0])
  console.log("\n📋 Job #34:")
  console.log(JSON.stringify(job, null, 2))

  // Avatar info
  const avatar = await sql`SELECT * FROM avatars WHERE id = ${job.avatar_id}`.then(r => r[0])
  console.log("\n👤 Avatar:")
  console.log(JSON.stringify(avatar, null, 2))

  // Все Kie tasks
  const tasks = await sql`
    SELECT * FROM kie_tasks
    WHERE job_id = 34
    ORDER BY prompt_index
  `

  console.log(`\n🔄 Kie Tasks (${tasks.length}):`)
  for (const t of tasks) {
    console.log(`\n  Task #${t.id} | prompt=${t.prompt_index} | status=${t.status}`)
    console.log(`    kie_task_id: ${t.kie_task_id}`)
    console.log(`    result_url: ${t.result_url || 'NULL'}`)
    console.log(`    error_message: ${t.error_message || 'NULL'}`)
    console.log(`    attempts: ${t.attempts}`)
    console.log(`    created: ${t.created_at}`)
    console.log(`    updated: ${t.updated_at}`)
  }

  // Проверяем generated_photos для avatar 40
  const photos = await sql`
    SELECT * FROM generated_photos
    WHERE avatar_id = 40
  `
  console.log(`\n🖼️ Generated photos для avatar #40: ${photos.length}`)

  // Проверяем style_id в tasks
  const styles = await sql`
    SELECT DISTINCT style_id FROM kie_tasks WHERE job_id = 34
  `
  console.log(`\n🎨 Style ID в kie_tasks: ${styles.map(s => s.style_id).join(', ')}`)

  // Может быть фото сохранились с другим avatar_id?
  const recentPhotos = await sql`
    SELECT id, avatar_id, style_id, created_at
    FROM generated_photos
    WHERE created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
  `
  console.log(`\n📸 Все фото за 24 часа (${recentPhotos.length}):`)
  for (const p of recentPhotos) {
    console.log(`  Photo #${p.id} | avatar=${p.avatar_id} | style=${p.style_id}`)
  }

  // Проверяем result_url в completed tasks
  const completedWithUrl = await sql`
    SELECT COUNT(*) as count FROM kie_tasks
    WHERE job_id = 34 AND status = 'completed' AND result_url IS NOT NULL
  `
  console.log(`\n✅ Completed tasks с result_url: ${completedWithUrl[0].count}`)

  const completedWithoutUrl = await sql`
    SELECT COUNT(*) as count FROM kie_tasks
    WHERE job_id = 34 AND status = 'completed' AND result_url IS NULL
  `
  console.log(`❌ Completed tasks БЕЗ result_url: ${completedWithoutUrl[0].count}`)
}

check().catch(console.error)
