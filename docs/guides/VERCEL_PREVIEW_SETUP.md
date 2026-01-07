# ⚡ Vercel Preview Setup - Quick Guide

## 🎯 Цель
Настроить Preview окружение для тестирования изменений 5-8 фото.

---

## 📋 Что Нужно Сделать

### 1. Создать Preview Branch в Neon (ОБЯЗАТЕЛЬНО)

**Neon Console:** https://console.neon.tech

1. Открыть проект PinGlass
2. **Branches** → **Create Branch**
3. Заполнить:
   - **Name:** `preview-reference-photos`
   - **Parent branch:** `main`
   - **Compute:** Shared (для экономии)
4. **Create Branch**
5. **Скопировать Connection String:**
   ```
   postgresql://user:password@preview-xxx.neon.tech/pinglass
   ```

---

### 2. Настроить Environment Variables в Vercel

**Vercel Dashboard:** https://vercel.com/dashboard

**Путь:** Project → Settings → Environment Variables

#### ТОЛЬКО 4 переменные для Preview:

| Variable | Value | Environment |
|----------|-------|-------------|
| `DATABASE_URL` | `postgresql://...preview-branch...` | **Preview** |
| `TBANK_TERMINAL_KEY` | `1765404063316DEMO` | **Preview** |
| `TBANK_PASSWORD` | `your_demo_password` | **Preview** |
| `NEXT_PUBLIC_APP_URL` | `$VERCEL_URL` | **Preview** |

**Важно:**
- Environment: выбрать **Preview**
- Branch: `preview/reference-photos-5-8` (или оставить для всех preview)
- Все остальные переменные наследуются из Production

---

### 3. Deploy Preview

Vercel автоматически создаст deployment после push (уже сделан ✅).

**Проверить статус:**
1. Vercel Dashboard → PinGlass → Deployments
2. Найти `preview/reference-photos-5-8`
3. Статус должен быть **Ready** (зелёная галочка)

**Preview URL:**
```
https://pinglass-git-preview-reference-photos-5-8-your-team.vercel.app
```

---

## 🧪 Quick Test Checklist

### Upload Test (5-8 фото)
- [ ] 4 фото → ❌ "минимум 5"
- [ ] 5 фото → ✅ кнопка активна
- [ ] 8 фото → ✅ 100% progress
- [ ] 9 фото → ❌ "максимум 8"

### File Size (30MB)
- [ ] 20MB фото → ✅ загружается
- [ ] 35MB фото → ❌ "максимум 30MB"

### Payment (T-Bank DEMO)
Тестовая карта: `4300000000000777`
- [ ] Оплата → ✅ test page открылась
- [ ] Статус → ✅ `paid: true`

### UI Texts
- [ ] Dashboard: "5-8 своих фото"
- [ ] Upload: "X/8 фото"

---

## 🔍 Monitoring

### Vercel Logs (Реальное время)
```bash
vercel logs --follow
```

### Sentry (Preview errors)
Фильтр: `environment:preview`

### Neon (Preview database)
Подключиться к preview branch и проверить данные.

---

## ⚠️ Важно

### Что НУЖНО отдельное:
- ✅ **Neon Database** (preview branch)
- ✅ **T-Bank** (DEMO терминал)

### Что можно ОБЩЕЕ:
- 🟢 **Kie AI** (тот же key)
- 🟢 **Cloudflare R2** (тот же bucket)
- 🟢 **QStash** (тот же endpoint)
- 🟢 **Sentry** (тот же проект, environment tag)
- 🟢 **Telegram Bot** (тот же бот)

---

## 🚀 Ready to Deploy?

**Команды:**
```bash
# Проверить текущую ветку
git branch
# Должно быть: * preview/reference-photos-5-8

# Уже запушено в GitHub ✅
# Vercel автоматически начнёт deploy

# Проверить статус
vercel ls
```

**Next Steps:**
1. ✅ Создать Neon preview branch
2. ✅ Настроить 4 env vars в Vercel
3. ⏳ Дождаться deploy (обычно 2-3 минуты)
4. ⏳ Протестировать по чеклисту выше

---

**Дата:** 2025-12-30
**Ветка:** `preview/reference-photos-5-8`
**Commit:** `766d54e` (optimize reference photo requirements)

