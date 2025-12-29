# 🚀 Preview Deployment Guide - Reference Photos 5-8

## Ветка: `preview/reference-photos-5-8`

Этот гайд описывает настройку Preview окружения в Vercel для тестирования изменений с 5-8 референсными фото.

---

## 📋 Изменения в Preview

- **Минимум фото:** 10 → **5**
- **Максимум фото:** 20 → **8**
- **Размер загрузки:** 10MB/50MB → **30MB** (unified)
- **UI тексты:** "10-20 фото" → "5-8 фото"

---

## 🔧 Environment Variables для Vercel Preview

### 1️⃣ **Database (Neon) - ОБЯЗАТЕЛЬНО ОТДЕЛЬНАЯ**

```bash
# Создать preview branch в Neon Console:
# 1. Зайти в Neon Console: https://console.neon.tech
# 2. Выбрать проект PinGlass
# 3. Branches → Create Branch
# 4. Name: preview-reference-photos
# 5. Parent branch: main
# 6. Скопировать DATABASE_URL

DATABASE_URL=postgresql://user:password@preview-branch.neon.tech/pinglass
```

**Важно:** Preview ветка Neon изолирует тестовые данные от production!

---

### 2️⃣ **T-Bank Payment - TEST MODE**

```bash
# Использовать DEMO терминал (суффикс DEMO)
# Это ТЕСТОВЫЙ терминал который принимает test card numbers
TBANK_TERMINAL_KEY=1765404063316DEMO
TBANK_PASSWORD=your_demo_terminal_password
```

**Тестовые карты T-Bank:**
- `4300000000000777` (успешная оплата)
- `5555555555554444` (успешная оплата)
- `4111111111111111` (отклонена)

**Примечание:** DEMO терминал использует РЕАЛЬНОЕ API T-Bank, но не создаёт реальных платежей.

---

### 3️⃣ **App URL - Preview URL**

```bash
# Vercel автоматически создаст preview URL
# Формат: https://pinglass-git-preview-reference-photos-5-8-your-team.vercel.app
# Можно оставить пустым, Vercel сам подставит
NEXT_PUBLIC_APP_URL=https://pinglass-git-preview-reference-photos-5-8-your-team.vercel.app
```

Или использовать environment-specific переменную:
```bash
NEXT_PUBLIC_APP_URL=$VERCEL_URL
```

---

### 4️⃣ **Сервисы - Можно Использовать Production Keys**

#### Kie AI (МОЖНО ОБЩИЙ)
```bash
# Используем тот же API key что и production
# Preview генерации просто расходуют токены из общего баланса
KIE_AI_API_KEY=kie_your_production_key
```

#### Google AI (МОЖНО ОБЩИЙ)
```bash
GOOGLE_API_KEY=your_production_google_key
```

#### Cloudflare R2 (МОЖНО ОБЩИЙ BUCKET)
```bash
# Файлы preview будут изолированы по avatarId
R2_ACCOUNT_ID=your_production_account_id
R2_ACCESS_KEY_ID=your_production_access_key
R2_SECRET_ACCESS_KEY=your_production_secret_key
R2_BUCKET_NAME=pinglass
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

#### QStash (МОЖНО ОБЩИЙ)
```bash
# Preview задачи не конфликтуют с production
QSTASH_TOKEN=ey_your_production_token
QSTASH_CURRENT_SIGNING_KEY=sig_your_production_key
QSTASH_NEXT_SIGNING_KEY=sig_your_production_key
```

#### Sentry (МОЖНО ОБЩИЙ ПРОЕКТ)
```bash
# Errors будут помечены environment: preview
SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/1234567
NEXT_PUBLIC_SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/1234567
SENTRY_AUTH_TOKEN=sntrys_your_token
SENTRY_ORG=your-org
SENTRY_PROJECT=pinglass
```

#### Telegram Bot (МОЖНО ОБЩИЙ)
```bash
# Тот же бот, preview пользователи просто тестовые
TELEGRAM_BOT_TOKEN=your_production_bot_token
```

#### Admin Access
```bash
# Добавить свой Telegram ID для доступа к /admin
ADMIN_TELEGRAM_IDS=123456789,987654321
```

---

## 🚀 Инструкция по Deploy в Vercel

### Шаг 1: Push Preview Branch

```bash
# Убедитесь что вы на preview ветке
git branch
# Должно показать: * preview/reference-photos-5-8

# Push в GitHub
git push -u origin preview/reference-photos-5-8
```

### Шаг 2: Настройка Vercel (через UI)

1. **Зайти в Vercel Dashboard:** https://vercel.com/dashboard
2. **Выбрать проект:** PinGlass
3. **Settings → Environment Variables**
4. **Добавить переменные для Preview environment:**
   - Environment: **Preview**
   - Branch: `preview/reference-photos-5-8` (или оставить для всех preview)

**КРИТИЧНО - Добавить ТОЛЬКО эти переменные для Preview:**

```
DATABASE_URL = postgresql://...preview-branch...
TBANK_TERMINAL_KEY = 1765404063316DEMO
TBANK_PASSWORD = your_demo_password
NEXT_PUBLIC_APP_URL = $VERCEL_URL
```

**Все остальные** (Kie AI, R2, QStash, Sentry) **наследуются из Production**.

### Шаг 3: Trigger Preview Deployment

Vercel автоматически создаст preview deployment после push. Или можно вручную:

1. **Git → Deployments**
2. **Найти:** `preview/reference-photos-5-8`
3. **Кликнуть "Redeploy"** (если нужно)

### Шаг 4: Получить Preview URL

После деплоя Vercel покажет URL:
```
https://pinglass-git-preview-reference-photos-5-8-your-team.vercel.app
```

---

## 🧪 Тестирование Preview

### Чеклист Тестирования

**1. Upload Flow (5-8 фото):**
- [ ] Загрузить 4 фото → должна быть ошибка "минимум 5"
- [ ] Загрузить 5 фото → кнопка "Продолжить" активна
- [ ] Загрузить 8 фото → progress bar показывает 100%
- [ ] Попытка загрузить 9е фото → должна быть ошибка "максимум 8"

**2. File Size (30MB):**
- [ ] Загрузить фото 20MB → успешно
- [ ] Загрузить фото 30MB → успешно
- [ ] Загрузить фото 35MB → ошибка "максимум 30MB"

**3. Compression:**
- [ ] Проверить размер в R2 после загрузки
- [ ] Reference photos должны быть ~2-5MB после компрессии

**4. Payment (T-Bank DEMO):**
- [ ] Создать оплату → должен открыться T-Bank test page
- [ ] Использовать test card `4300000000000777`
- [ ] Проверить статус → `isPro: true`
- [ ] Проверить webhook → status updated

**5. Generation:**
- [ ] Запустить генерацию с 5 фото
- [ ] Проверить что все 5 используются как референсы
- [ ] Проверить консистентность лица в 7/15/23 фото

**6. UI Texts:**
- [ ] Dashboard: "Загрузите 5-8 своих фото"
- [ ] Upload view: progress "X/8 фото"
- [ ] Upload view: "Нужно ещё X фото" (если < 5)

---

## 📊 Monitoring Preview

### Sentry
Errors в preview будут помечены:
```json
{
  "environment": "preview",
  "release": "preview/reference-photos-5-8@commit-hash"
}
```

Фильтр в Sentry:
```
environment:preview
```

### Vercel Logs
```bash
# Реальном времени через CLI
vercel logs --follow https://pinglass-git-preview-reference-photos-5-8.vercel.app
```

### Neon Database
Проверить preview branch:
```sql
-- Подключиться к preview branch
-- Проверить тестовые данные
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM avatars;
SELECT COUNT(*) FROM reference_photos;
```

---

## 🔄 Обновление Preview

Если нужно внести изменения:

```bash
# Переключиться на preview ветку
git checkout preview/reference-photos-5-8

# Внести изменения
# ...

# Commit & Push
git add .
git commit -m "fix: update preview"
git push origin preview/reference-photos-5-8
```

Vercel автоматически создаст новый preview deployment.

---

## ✅ Готово к Merge в Main

После успешного тестирования:

```bash
# Переключиться на main
git checkout main

# Merge preview ветку
git merge preview/reference-photos-5-8

# Push в main (production)
git push origin main
```

Vercel автоматически задеплоит в production.

---

## 🧹 Cleanup После Тестирования

1. **Удалить preview ветку в Git:**
```bash
git branch -d preview/reference-photos-5-8
git push origin --delete preview/reference-photos-5-8
```

2. **Удалить Neon preview branch:**
   - Neon Console → Branches → Delete `preview-reference-photos`

3. **Удалить тестовые данные в R2 (опционально):**
   - Если использовали отдельный bucket/prefix

---

## 📞 Поддержка

**Проблемы с Preview:**
- Check Vercel logs: `vercel logs`
- Check Sentry: `environment:preview`
- Check Neon: Preview branch status

**Questions:**
- Vercel Docs: https://vercel.com/docs/deployments/preview-deployments
- Neon Docs: https://neon.tech/docs/guides/branching

---

**Дата создания:** 2025-12-30
**Версия:** 1.0
**Автор:** PinGlass Team

