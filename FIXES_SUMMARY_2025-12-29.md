# 🔧 Исправление Найденных Проблем - 2025-12-29

## ✅ Исправленные Проблемы

### 1. **КРИТИЧНО: Ошибка загрузки фото (10MB лимит)** ✅

**Проблема:**
- Пользователь получал "Ошибка загрузки - Не удалось обработать фото для сохранения"
- Telegram часто отправляет фото >10MB
- `app/api/upload/route.ts:22` имел лимит 10MB

**Решение:**
- ✅ Увеличен лимит до **50MB** для загрузки
- ✅ Добавлена автоматическая компрессия с Sharp
  - Reference photos: 1920x1920, quality 82, ~2-5MB
  - Thumbnails: 512x512, quality 75, ~300-500KB
  - Generated: 2560x2560, quality 90 (без компрессии)
- ✅ Компрессия работает для FormData и Base64

**Файл:** `app/api/upload/route.ts`

```typescript
// До:
const MAX_FILE_SIZE = 10 * 1024 * 1024

// После:
const MAX_FILE_SIZE = 50 * 1024 * 1024
const MAX_REFERENCE_SIZE = 5 * 1024 * 1024
const MAX_THUMBNAIL_SIZE = 500 * 1024

// Новая функция компрессии
async function compressImage(buffer, imageType, contentType) {
  // Sharp: resize + JPEG quality optimization
  // Reference: 1920x1920, q82
  // Thumbnail: 512x512, q75
}
```

---

### 2. **Референсные Фото и Консистентность** ✅

**Анализ:**
- ✅ Reference photos работают КОРРЕКТНО
- User #287: 14 референсных фото → 15 сгенерированных
- User #335: 13 референсных фото загружены в R2
- Все фото сохраняются в `reference_photos` таблицу
- Kie AI использует ВСЕ reference photos для консистентности

**Вывод:** Проблем НЕ обнаружено. Система работает как задумано.

---

## ⚠️ Требуют Исправления

### 3. **КРИТИЧНО: Результаты НЕ отображаются реактивно** 🔴

**Проблема:**
- Пользователь видит результаты ТОЛЬКО после перезагрузки страницы
- Нет polling во время генерации
- `components/persona-app.tsx:312` загружает фото только при переходе в RESULTS view

**Текущий код:**
```typescript
// components/persona-app.tsx:312-348
useEffect(() => {
  const loadPhotosForResults = async () => {
    if (viewState.view !== "RESULTS" || !("personaId" in viewState)) return
    // ... fetch photos ONCE
  }
  loadPhotosForResults() // ТОЛЬКО при mount!
}, [viewState, personas, updatePersona])
```

**Решение:**
Добавить reactive polling во время генерации:

```typescript
// components/persona-app.tsx (НОВЫЙ useEffect)
useEffect(() => {
  if (!isGenerating || viewState.view !== "RESULTS") return

  const avatarId = "personaId" in viewState ? viewState.personaId : null
  if (!avatarId) return

  // Start polling for new photos every 3 seconds
  startPolling("generation-photos", async () => {
    try {
      const res = await fetch(`/api/avatars/${avatarId}/photos`)
      if (res.ok) {
        const data = await res.json()
        if (data.photos?.length > 0) {
          const persona = personas.find(p => p.id === avatarId)
          const currentCount = persona?.generatedAssets?.length || 0

          // Update if we have MORE photos
          if (data.photos.length > currentCount) {
            console.log(`[Polling] New photos: ${data.photos.length} (was ${currentCount})`)

            const newAssets = data.photos.map((p: any) => ({
              id: p.id.toString(),
              url: p.image_url,
              type: "image" as const,
              createdAt: new Date(p.created_at).getTime(),
            }))

            updatePersona(avatarId, {
              generatedAssets: newAssets,
              status: data.photos.length >= (tierPhotos || 7) ? "ready" : "generating"
            })

            // Update progress
            setGenerationProgress({
              completed: data.photos.length,
              total: tierPhotos || 7
            })

            // If generation complete, stop polling
            if (data.photos.length >= (tierPhotos || 7)) {
              stopPolling("generation-photos")
              setIsGenerating(false)
              showMessage("✨ Генерация завершена!")
            }
          }
        }
      }
    } catch (err) {
      console.error("[Polling] Failed to fetch photos:", err)
    }
  }, {
    intervalMs: 3000, // Poll every 3 seconds
    maxAttempts: 200, // Max 10 minutes (200 * 3s)
    onTimeout: () => {
      setIsGenerating(false)
      showMessage("Генерация занимает больше времени. Проверьте позже.")
    }
  })

  return () => {
    stopPolling("generation-photos")
  }
}, [isGenerating, viewState, personas, updatePersona, startPolling, stopPolling, showMessage, tierPhotos])
```

**Файл для изменения:** `components/persona-app.tsx`

**Добавить зависимость:** `startPolling`, `stopPolling` из `usePolling()`

---

### 4. **Кэширование Онбординг Изображений** 🟡

**Проблема:**
- Demo фото загружаются каждый раз заново
- Нет HTTP caching headers
- Медленная загрузка на медленном интернете

**Решение:**

#### A. Next.js Image Optimization (рекомендуется)
```typescript
// components/onboarding.tsx
import Image from "next/image"

// До:
<img src="/demo/Screenshot_1.png" />

// После:
<Image
  src="/demo/Screenshot_1.png"
  width={400}
  height={600}
  alt="PinGlass Example"
  priority // First 3 images load immediately
  quality={85}
/>
```

#### B. Add Cache Headers
```typescript
// next.config.mjs
export default {
  async headers() {
    return [
      {
        source: "/demo/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ]
  },
}
```

#### C. Preload Critical Images
```typescript
// app/layout.tsx
export default function RootLayout() {
  return (
    <html>
      <head>
        <link rel="preload" as="image" href="/demo/Screenshot_1.png" />
        <link rel="preload" as="image" href="/demo/Screenshot_2.png" />
        <link rel="preload" as="image" href="/demo/Screenshot_3.png" />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

---

### 5. **Отправка Фото в Telegram** ✅ (работает, но можно улучшить)

**Текущий статус:**
- ✅ Автоматическая отправка работает (из `poll-kie-tasks/route.ts:247`)
- ✅ Фото отправляются пакетами по 10
- ✅ Telegram message queue работает корректно

**Возможное улучшение (опционально):**
Добавить retry механизм для failed отправок:

```typescript
// app/api/cron/poll-kie-tasks/route.ts:253
async function sendPhotosToTelegram(avatarId: number) {
  // ... existing code ...

  // Add retry for failed photos
  if (errors.length > 0) {
    console.warn(`[Telegram] ${errors.length} photos failed, will retry...`)

    // Queue failed photos for retry (use telegram_message_queue)
    for (const failedUrl of failedPhotoUrls) {
      await sql`
        INSERT INTO telegram_message_queue (telegram_chat_id, message_type, photo_url, status)
        VALUES (${chatId}, 'photo', ${failedUrl}, 'pending')
      `
    }
  }
}
```

---

## 📊 Статус Исправлений

| Проблема | Статус | Приоритет |
|----------|--------|-----------|
| 1. Загрузка фото 10MB лимит | ✅ ИСПРАВЛЕНО | 🔴 КРИТИЧНО |
| 2. Компрессия изображений | ✅ ДОБАВЛЕНО | 🔴 КРИТИЧНО |
| 3. Реактивное отображение результатов | ⏳ КОД ГОТОВ | 🔴 КРИТИЧНО |
| 4. Кэширование онбординг | ⏳ РЕКОМЕНДАЦИИ | 🟡 СРЕДНЕ |
| 5. Telegram retry | ⏳ ОПЦИОНАЛЬНО | 🟢 НИЗКИЙ |

---

## 🧪 Тестирование

### 1. Тест загрузки больших фото
```bash
# Upload 20MB photo from Telegram
# Expected: Success + compressed to ~2-5MB
```

### 2. Тест реактивных результатов
```bash
# 1. Start generation
# 2. Stay on RESULTS screen
# 3. Expect: Photos appear automatically every 3 seconds
# 4. Expect: Progress bar updates: 1/7, 2/7, ... 7/7
# 5. Expect: "Генерация завершена!" when done
```

### 3. Тест Telegram отправки
```bash
# 1. Complete generation
# 2. Check Telegram bot
# 3. Expected: 7/15/23 photos delivered in batches of 10
```

---

## 🚀 Деплой

1. **Установить Sharp** (если ещё не установлен):
```bash
pnpm add sharp
```

2. **Применить изменения:**
- ✅ `app/api/upload/route.ts` - уже изменён
- ⏳ `components/persona-app.tsx` - добавить polling useEffect
- ⏳ `next.config.mjs` - добавить cache headers (опционально)
- ⏳ `components/onboarding.tsx` - использовать Next Image (опционально)

3. **Тестировать:**
```bash
pnpm dev
# Test upload 20MB+ photo
# Test reactive results display
```

4. **Deploy to Vercel:**
```bash
git add .
git commit -m "fix: increase upload to 50MB, add compression, reactive results"
git push origin main
```

---

## 📝 Код для Внедрения

### `components/persona-app.tsx` - Добавить после строки 348

```typescript
// REACTIVE POLLING FOR GENERATION RESULTS
useEffect(() => {
  if (!isGenerating || viewState.view !== "RESULTS") return

  const avatarId = "personaId" in viewState ? viewState.personaId : null
  if (!avatarId) return

  console.log("[Polling] Starting reactive photo polling for avatar:", avatarId)

  startPolling("generation-photos", async () => {
    try {
      const res = await fetch(`/api/avatars/${avatarId}/photos`)
      if (!res.ok) return

      const data = await res.json()
      if (!data.photos || data.photos.length === 0) return

      const persona = personas.find(p => p.id === avatarId)
      const currentCount = persona?.generatedAssets?.length || 0

      if (data.photos.length > currentCount) {
        console.log(`[Polling] New photos detected: ${data.photos.length} (was ${currentCount})`)

        const newAssets = data.photos.map((p: any) => ({
          id: p.id.toString(),
          url: p.image_url,
          type: "image" as const,
          createdAt: new Date(p.created_at).getTime(),
        }))

        updatePersona(avatarId, {
          generatedAssets: newAssets,
        })

        setGenerationProgress({
          completed: data.photos.length,
          total: generationProgress.total || 7
        })

        // Check if generation complete
        if (data.photos.length >= generationProgress.total) {
          console.log("[Polling] Generation complete!")
          stopPolling("generation-photos")
          setIsGenerating(false)
          updatePersona(avatarId, { status: "ready" })
          showMessage("✨ Генерация завершена!")
        }
      }
    } catch (err) {
      console.error("[Polling] Error fetching photos:", err)
    }
  }, {
    intervalMs: 3000,
    maxAttempts: 200, // 10 minutes max
    onTimeout: () => {
      setIsGenerating(false)
      showMessage("Генерация занимает больше времени. Проверьте позже.")
    }
  })

  return () => {
    stopPolling("generation-photos")
  }
}, [
  isGenerating,
  viewState,
  personas,
  updatePersona,
  startPolling,
  stopPolling,
  showMessage,
  generationProgress
])
```

---

## ✅ Итого

**ИСПРАВЛЕНО:**
1. ✅ Upload limit 10MB → 50MB
2. ✅ Автоматическая компрессия изображений (Sharp)
3. ✅ Reference photos консистентность (уже работала)

**ТРЕБУЕТСЯ ДОБАВИТЬ:**
1. ⏳ Reactive polling для отображения результатов (код готов)
2. ⏳ Кэширование онбординг изображений (рекомендации)

**ВРЕМЯ ВНЕДРЕНИЯ:** ~15-30 минут

**ДАТА:** 2025-12-29 22:30 MSK
