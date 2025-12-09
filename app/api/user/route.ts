import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

// Получить или создать пользователя по device_id
export async function POST(request: NextRequest) {
  try {
    const { deviceId } = await request.json()

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID required" }, { status: 400 })
    }

    // Проверяем существующего пользователя
    let user = await sql`
      SELECT * FROM users WHERE device_id = ${deviceId}
    `.then((rows) => rows[0])

    // Создаем если нет
    if (!user) {
      user = await sql`
        INSERT INTO users (device_id) VALUES (${deviceId})
        RETURNING *
      `.then((rows) => rows[0])
    }

    return NextResponse.json({
      id: user.id,
      deviceId: user.device_id,
    })
  } catch (error) {
    console.error("User error:", error)
    return NextResponse.json({ error: "Failed to get/create user" }, { status: 500 })
  }
}
