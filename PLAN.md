# План реализации: ZIP скачивание, Telegram бот, улучшенный UI

## Обзор

Реализуем три функции для улучшения доставки сгенерированных фото пользователям:

1. **ZIP скачивание** — кнопка "Скачать всё" для загрузки всех фото одним архивом
2. **Telegram бот** — отправка фото напрямую в Telegram чат пользователя
3. **Улучшенный UI** — кнопки шеринга, галерея с swipe, лайтбокс

---

## 1. ZIP Скачивание

### Архитектура

```
┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│   ResultsView    │────▶│  JSZip (client) │────▶│  .zip файл   │
│  "Скачать всё"   │     │  + FileSaver    │     │  на диск     │
└──────────────────┘     └─────────────────┘     └──────────────┘
```

### Подход: Клиентская генерация (рекомендуется)

**Почему клиент, а не сервер:**
- Нет нагрузки на сервер
- Работает с любыми URL (внешние хостинги)
- Быстрее для пользователя
- Не требует серверного storage

**Зависимости:**
```bash
npm install jszip file-saver
npm install -D @types/file-saver
```

### Компоненты

#### 1.1 Утилита `lib/download-zip.ts`
```typescript
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

interface DownloadProgress {
  current: number
  total: number
  percentage: number
}

export async function downloadPhotosAsZip(
  urls: string[],
  filename: string = 'pinglass-photos.zip',
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  const zip = new JSZip()
  const folder = zip.folder('photos')

  let completed = 0

  // Загружаем все изображения параллельно (с ограничением)
  const batchSize = 5
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize)

    await Promise.all(batch.map(async (url, idx) => {
      try {
        const response = await fetch(url)
        const blob = await response.blob()
        const extension = blob.type.split('/')[1] || 'jpg'
        folder?.file(`photo-${i + idx + 1}.${extension}`, blob)
      } catch (error) {
        console.error(`Failed to fetch ${url}:`, error)
      }

      completed++
      onProgress?.({
        current: completed,
        total: urls.length,
        percentage: Math.round((completed / urls.length) * 100)
      })
    }))
  }

  // Генерируем ZIP
  const content = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  })

  // Скачиваем
  saveAs(content, filename)
}
```

#### 1.2 Кнопка в ResultsView
```tsx
const [isDownloading, setIsDownloading] = useState(false)
const [downloadProgress, setDownloadProgress] = useState(0)

const handleDownloadAll = async () => {
  setIsDownloading(true)
  try {
    await downloadPhotosAsZip(
      assets.map(a => a.url),
      `${persona.name}-pinglass.zip`,
      (progress) => setDownloadProgress(progress.percentage)
    )
  } finally {
    setIsDownloading(false)
    setDownloadProgress(0)
  }
}

// В JSX:
<button onClick={handleDownloadAll} disabled={isDownloading}>
  {isDownloading ? (
    <>Загрузка {downloadProgress}%</>
  ) : (
    <>Скачать все ({assets.length})</>
  )}
</button>
```

### Файлы для изменения

| Файл | Действие |
|------|----------|
| `lib/download-zip.ts` | Создать новый файл |
| `components/persona-app.tsx` | Добавить кнопку и логику в ResultsView |
| `package.json` | Добавить jszip, file-saver |

---

## 2. Telegram Бот

### Архитектура

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Frontend    │     │  API Route   │     │ Telegram Bot │
│ "Отправить   │────▶│ /api/telegram│────▶│    API      │
│ в Telegram"  │     │  /send       │     │ sendMediaGrp│
└──────────────┘     └──────────────┘     └──────────────┘
        │                                        │
        │                                        ▼
        │            ┌──────────────────────────────────────┐
        └───────────▶│ t.me/PinGlassBot?start={session_id} │
                     │ Пользователь нажимает /start         │
                     │ Бот связывает chat_id с session_id   │
                     └──────────────────────────────────────┘
```

### Подход: Webhook + Deep Link

**Почему этот подход:**
- Не требует авторизации пользователя
- Простая интеграция
- Работает на мобильных устройствах

### Flow

1. Пользователь нажимает "Отправить в Telegram"
2. Создаётся уникальный `session_id` и сохраняется в БД вместе с URLs фото
3. Открывается ссылка `t.me/PinGlassBot?start={session_id}`
4. Пользователь нажимает Start в боте
5. Бот получает `session_id` из команды `/start`
6. Бот находит фото по `session_id` и отправляет их в чат

### Компоненты

#### 2.1 Новая таблица в БД
```sql
CREATE TABLE telegram_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(64) UNIQUE NOT NULL,
  chat_id BIGINT,  -- заполняется когда пользователь нажмёт Start
  photo_urls TEXT[] NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, linked, sent, expired
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
);
```

#### 2.2 API Routes

**`app/api/telegram/create-session/route.ts`**
```typescript
// POST: создаёт сессию для отправки фото
// Request: { urls: string[] }
// Response: { sessionId: string, botLink: string }
```

**`app/api/telegram/webhook/route.ts`**
```typescript
// POST: webhook от Telegram
// Обрабатывает /start {session_id}
// Связывает chat_id с session_id
// Отправляет фото через sendMediaGroup
```

#### 2.3 Библиотека бота `lib/telegram-bot.ts`
```typescript
import { Telegraf } from 'telegraf'

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!)

export async function sendPhotosToChat(
  chatId: number,
  photoUrls: string[],
  caption?: string
): Promise<void> {
  // Telegram ограничивает mediaGroup до 10 фото
  const chunks = chunkArray(photoUrls, 10)

  for (const chunk of chunks) {
    const media = chunk.map((url, i) => ({
      type: 'photo' as const,
      media: url,
      caption: i === 0 ? caption : undefined
    }))

    await bot.telegram.sendMediaGroup(chatId, media)
  }
}

export { bot }
```

### Настройка бота

1. Создать бота через @BotFather
2. Получить токен
3. Настроить webhook: `https://yourdomain.com/api/telegram/webhook`
4. Добавить `TELEGRAM_BOT_TOKEN` в env

### Файлы для создания/изменения

| Файл | Действие |
|------|----------|
| `lib/telegram-bot.ts` | Создать |
| `app/api/telegram/create-session/route.ts` | Создать |
| `app/api/telegram/webhook/route.ts` | Создать |
| `components/persona-app.tsx` | Добавить кнопку |
| `package.json` | Добавить telegraf |

### ENV переменные
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=random_secret_string
```

---

## 3. Улучшенный UI

### 3.1 Новый дизайн ResultsView

```
┌─────────────────────────────────────────────────────────────┐
│  ← Назад                              [Создать ещё]         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                      │    │
│  │                   ГЛАВНОЕ ФОТО                      │    │
│  │                   (с swipe)                         │    │
│  │                                                      │    │
│  │  [<]                                           [>]  │    │
│  │                                                      │    │
│  │                    1 / 23                           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [⬇️ ZIP] [📱 Telegram] [🔗 Копировать] [📤 Поделиться] │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐         │
│  │    │ │    │ │    │ │    │ │    │ │    │ │    │  ...    │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘         │
│  (миниатюры с горизонтальным скроллом)                      │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Компоненты

#### ShareButtons компонент
```tsx
interface ShareButtonsProps {
  urls: string[]
  title: string
  onDownloadZip: () => void
  onSendTelegram: () => void
  isDownloading: boolean
}

const ShareButtons: React.FC<ShareButtonsProps> = ({...}) => (
  <div className="flex gap-2 flex-wrap">
    <button onClick={onDownloadZip}>
      <Archive /> Скачать ZIP
    </button>
    <button onClick={onSendTelegram}>
      <Send /> Telegram
    </button>
    <button onClick={handleShare}>
      <Share2 /> Поделиться
    </button>
  </div>
)
```

#### PhotoGallery с swipe
```tsx
// Используем CSS scroll-snap для нативного swipe
<div className="flex overflow-x-auto snap-x snap-mandatory">
  {photos.map(photo => (
    <div key={photo.id} className="snap-center shrink-0 w-full">
      <img src={photo.url} />
    </div>
  ))}
</div>
```

### 3.3 Web Share API (нативный шеринг)
```typescript
const handleNativeShare = async () => {
  if (navigator.share) {
    await navigator.share({
      title: 'Мои AI-фото от PinGlass',
      text: 'Смотри какие фото я сгенерировал!',
      url: window.location.href
    })
  } else {
    // Fallback: копировать ссылку
    await navigator.clipboard.writeText(window.location.href)
    toast('Ссылка скопирована!')
  }
}
```

### Файлы для изменения

| Файл | Действие |
|------|----------|
| `components/persona-app.tsx` | Переработать ResultsView |
| `components/share-buttons.tsx` | Создать новый компонент |
| `components/photo-gallery.tsx` | Создать компонент галереи |

---

## Порядок реализации

### Фаза 1: ZIP скачивание (1-2 часа)
1. Установить зависимости (jszip, file-saver)
2. Создать `lib/download-zip.ts`
3. Добавить кнопку в ResultsView
4. Тестирование

### Фаза 2: Улучшенный UI (2-3 часа)
1. Создать ShareButtons компонент
2. Переработать ResultsView с новым дизайном
3. Добавить swipe галерею
4. Добавить Web Share API
5. Тестирование

### Фаза 3: Telegram бот (3-4 часа)
1. Создать бота через @BotFather
2. Установить telegraf
3. Создать таблицу telegram_sessions
4. Реализовать API routes
5. Добавить кнопку в UI
6. Настроить webhook на production
7. Тестирование

---

## Зависимости для установки

```bash
npm install jszip file-saver telegraf
npm install -D @types/file-saver
```

## ENV переменные

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_WEBHOOK_SECRET=your_random_secret
```

## SQL миграция

```sql
-- Таблица для Telegram сессий
CREATE TABLE telegram_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(64) UNIQUE NOT NULL,
  chat_id BIGINT,
  photo_urls TEXT[] NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Индекс для быстрого поиска
CREATE INDEX idx_telegram_sessions_session_id ON telegram_sessions(session_id);
CREATE INDEX idx_telegram_sessions_expires ON telegram_sessions(expires_at);
```

---

## Риски и митигации

| Риск | Митигация |
|------|-----------|
| CORS при скачивании изображений | Изображения с наших провайдеров (Kie.ai, fal.ai) должны иметь CORS headers |
| Telegram rate limits | Добавить задержки между sendMediaGroup |
| Большие ZIP файлы | Ограничить до ~50 фото, показывать прогресс |
| Webhook не доходит | Добавить retry логику, логирование |

---

## Готово к реализации?

После утверждения этого плана, начну с Фазы 1 (ZIP скачивание).
