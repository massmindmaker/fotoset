#!/usr/bin/env node
import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const sql = neon(process.env.DATABASE_URL)

async function check() {
  // Все аватары пользователя 287 (tg=1366531771)
  const avatars = await sql`
    SELECT * FROM avatars WHERE user_id = 287 ORDER BY created_at
  `

  console.log("Все аватары пользователя 287 (tg=1366531771):")
  for (const a of avatars) {
    const photoCount = await sql`SELECT COUNT(*) as cnt FROM generated_photos WHERE avatar_id = ${a.id}`.then(r => r[0].cnt)
    console.log(`\n  Avatar #${a.id} | status=${a.status} | photos=${photoCount} | created=${a.created_at}`)

    // Jobs для этого аватара
    const jobs = await sql`SELECT * FROM generation_jobs WHERE avatar_id = ${a.id} ORDER BY created_at`
    for (const j of jobs) {
      console.log(`    Job #${j.id} | status=${j.status} | ${j.completed_photos}/${j.total_photos}`)
    }
  }

  // Проверяем время отправки сообщения - когда было 1 фото?
  console.log("\n\nПроверяем первое фото для avatar 40:")
  const firstPhoto = await sql`
    SELECT * FROM generated_photos
    WHERE avatar_id = 40
    ORDER BY created_at ASC
    LIMIT 1
  `.then(r => r[0])

  if (firstPhoto) {
    console.log(`  Первое фото создано: ${firstPhoto.created_at}`)
  }
}

check().catch(console.error)
