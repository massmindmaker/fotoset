# PinGlass - Точные промпты для редизайна экранов

## Анализ реальных экранов приложения

---

## 1. ONBOARDING (Приветственный экран)

### Текущий контент:
- Логотип "Pinglass" (neon text effect)
- Подзаголовок: "Создавайте впечатляющие AI-фотографии"
- 11 демо-фото в orbital анимации (2 кольца)
- Кнопка "Начать!" с иконкой Sparkles
- Auth modal с Google OAuth + Email/Password

### Промпт для Nano Banana Pro:
```
Premium mobile app UI mockup, dark mode onboarding screen for AI photo generation app "Pinglass".

LAYOUT:
- Full screen dark gradient background (deep purple to black)
- Center: Large neon pink glowing logo text "Pinglass"
- Below logo: Subtitle text "Создавайте впечатляющие AI-фотографии" (Russian)
- Orbital animation effect: 11 floating portrait photos in 2 circular orbits around center
- Inner orbit: 4 photos at 115px radius
- Outer orbit: 6 photos at 175px radius
- Bottom: Gradient button "Начать!" with sparkle icon

STYLE:
- Glassmorphism cards for photos
- Neon pink glow effects (#FF6B6B)
- Holographic shine on photo frames
- Premium AI photo app aesthetic
- iOS 18 design language
- 9:16 mobile aspect ratio

QUALITY: 4K render, Figma/Sketch export quality, high-fidelity mockup
```

---

## 2. DASHBOARD (Мои аватары)

### Текущий контент:
- Header: "Мои аватары"
- Subheader: "Создавайте AI-фотографии в стиле PINGLASS"
- Empty state: Large card "Создать первый аватар" with Plus icon
- Pricing tiers: 3 cards (7/15/23 фото с ценами в рублях)
- Features: "До 23 фото" + "Безопасно" cards with icons

### Промпт для Nano Banana Pro:
```
Premium mobile app UI mockup, dark mode dashboard screen for AI photo app "Pinglass".

LAYOUT:
- Top: Header "Мои аватары" (bold title)
- Subtitle: "Создавайте AI-фотографии в стиле PINGLASS"
- Main: Large dashed-border card "Создать первый аватар" with Plus icon
- Text: "Загрузите 5-8 своих фото и получите до 23 профессиональных портрета"
- Section: "Тарифы" with 3 small tier cards in row:
  - "7 фото - 499 ₽"
  - "15 фото - 999 ₽" (with "Хит" badge)
  - "23 фото - 1499 ₽"
- Bottom: 2 feature cards side by side:
  - Zap icon + "До 23 фото / На выбор"
  - Shield icon + "Безопасно / Фото не сохраняются"

STYLE:
- Dark mode with subtle gradients
- Coral pink accent color (#FF6B6B)
- Glassmorphism cards
- Russian text labels
- Premium photo app aesthetic
- 9:16 mobile aspect ratio

QUALITY: 4K render, Figma-quality mockup
```

---

## 3. UPLOAD (Загрузка фото)

### Текущий контент:
- Back arrow + Editable name input "Название аватара..."
- Progress bar (5/8 фото)
- Info card: "Советы для лучшего результата" with Camera icon
  - Хорошее освещение лица
  - Разные ракурсы и выражения
  - Без солнечных очков и головных уборов
- Photo grid (3-5 columns) with uploaded photos
- Add button with Plus icon
- Fixed bottom: Gradient button "Создать" with Sparkles icon

### Промпт для Nano Banana Pro:
```
Premium mobile app UI mockup, dark mode photo upload screen for AI photo app.

LAYOUT:
- Top: Back arrow + text input "Название аватара..."
- Progress: Green progress bar showing "5/8 фото" with checkmark
- Yellow info card with Camera icon:
  - Title: "Советы для лучшего результата"
  - Bullets: "Хорошее освещение лица", "Разные ракурсы", "Без очков"
- Photo grid (3 columns):
  - First cell: dashed Plus button "Добавить"
  - 5 uploaded selfie photos with X delete buttons
  - 2 skeleton placeholder cells
- Fixed bottom bar: Gradient pink button "Создать" with sparkle icon

STYLE:
- Dark mode with glassmorphism
- Yellow/amber info card accent
- Green progress indicator
- Pink/coral primary button (#FF6B6B)
- Rounded photo thumbnails
- Russian text
- 9:16 mobile aspect ratio

QUALITY: 4K render, high-fidelity UI mockup
```

---

## 4. TIER SELECT (Выбор пакета)

### Текущий контент:
- Back arrow + "Выберите пакет" header
- Subtitle: "PINGLASS"
- 3 tier cards (radio buttons):
  - 7 фотографий - 499 ₽ - "Попробовать AI-фото"
  - 15 фотографий - 999 ₽ - "Оптимальный выбор" + "Хит" badge
  - 23 фотографий - 1499 ₽ - "Максимум возможностей"
- Price per photo shown (e.g. "71 ₽/фото")
- Selected card has checkmark "Выбрано"
- Fixed bottom: "Оплатить и получить X фото"

### Промпт для Nano Banana Pro:
```
Premium mobile app UI mockup, dark mode tier selection screen for AI photo app.

LAYOUT:
- Top: Back arrow + "Выберите пакет" (heading)
- Subtitle: "PINGLASS"
- 3 large selection cards (vertical stack):
  1. "7 фотографий" - "499 ₽" - "71 ₽/фото" - "Попробовать AI-фото"
  2. "15 фотографий" - "999 ₽" - "67 ₽/фото" - "Оптимальный выбор" + Star "Хит" badge (SELECTED with checkmark)
  3. "23 фотографий" - "1499 ₽" - "65 ₽/фото" - "Максимум возможностей"
- Selected card: Pink gradient border, "Выбрано" text with check icon
- Each card has large number icon (7/15/23) on left
- Fixed bottom: Pink gradient button "Оплатить и получить 15 фото" with sparkle

STYLE:
- Dark mode with glassmorphism cards
- Pink accent (#FF6B6B) for selection
- Star badge in gold/amber
- Green discount badges where applicable
- Russian text and Ruble currency
- 9:16 mobile aspect ratio

QUALITY: 4K render, Figma-quality mockup
```

---

## 5. PAYMENT MODAL (Оплата)

### Текущий контент:
- Header: Shield icon + "Безопасная оплата" + X close
- Tier summary: "15 фотографий" - "999 ₽"
- Email input: "Email для чека"
- 3 payment buttons:
  - "Оплатить картой 999 ₽" (orange gradient, CreditCard icon)
  - "Оплатить в Stars" (yellow border, Star icon) - Telegram only
  - "Оплатить в TON" (blue, Coins icon) - Telegram only

### Промпт для Nano Banana Pro:
```
Premium mobile app UI mockup, payment bottom sheet modal for AI photo app.

LAYOUT:
- Modal: Bottom sheet with rounded top corners, dark glassmorphism
- Header row: Green shield icon + "Безопасная оплата" + X close button
- Tier card: Image icon + "15 фотографий" + "Выбранный пакет" + "999 ₽"
- Email section: Mail icon + "Email для чека" label + text input
- Payment buttons (vertical stack):
  1. Orange gradient: CreditCard icon + "Оплатить картой 999 ₽"
  2. Yellow border: Star icon (filled) + "Оплатить в Stars"
  3. Blue: Coins icon + "Оплатить в TON"
- Background: Blurred dark overlay

STYLE:
- Dark glassmorphism modal
- Orange/coral primary button gradient (#FF6B6B to #FF8E53)
- Yellow Stars button with amber accents
- Blue TON button (#0098EA)
- Green shield verification icon
- Russian text
- 9:16 mobile aspect ratio

QUALITY: 4K render, high-fidelity modal mockup
```

---

## 6. RESULTS (Результаты генерации)

### Текущий контент:
- Back arrow + Generation progress badge "X / 23 фото"
- Progress card (when generating):
  - Sparkles icon + "AI генерация"
  - Progress bar with gradient
  - "X / 23 фото" + "~Y мин"
  - "Можете закрыть приложение — пришлём фото в Telegram"
- Photo gallery (masonry grid, 2-3 columns)
- Skeleton placeholders for pending photos

### Промпт для Nano Banana Pro:
```
Premium mobile app UI mockup, AI photo generation results screen.

LAYOUT:
- Top: Back arrow + Progress badge "12 / 23 фото" (pink background)
- Progress card (glassmorphism):
  - Sparkles icon + "AI генерация"
  - Pink gradient progress bar at 52%
  - "12 / 23 фото" left + "~6 мин" right
  - Gray text: "Можете закрыть приложение — пришлём фото в Telegram"
- Photo gallery: 2-column masonry grid
  - 12 completed AI portrait photos (professional quality)
  - 11 skeleton loading placeholders with spinner icons
- Each photo: 3:4 aspect ratio, rounded corners

STYLE:
- Dark mode with glassmorphism
- Pink/coral gradient progress (#FF6B6B)
- Professional AI-generated portrait previews
- Loading skeletons with pulse animation indication
- Russian text
- 9:16 mobile aspect ratio

QUALITY: 4K render, high-fidelity gallery mockup
```

---

## 7. AVATAR DETAIL (Детали аватара)

### Текущий контент:
- Back arrow + Editable name + Progress "5/8 фото"
- Tips card (same as Upload)
- Photo grid with reference photos
- Add button + Delete buttons on photos
- Action button: "Сгенерировать" or "Смотреть результат"

### Промпт для Nano Banana Pro:
```
Premium mobile app UI mockup, avatar detail screen for existing persona.

LAYOUT:
- Top: Back arrow + Name "Мой аватар" + progress "6/8 фото" (green)
- Tips card: Camera icon + "Советы для лучшего результата" (expandable)
- Photo grid (3 columns):
  - First: Plus button "Добавить"
  - 6 reference photos with X delete buttons (hover state)
- Fixed bottom: Pink gradient button "Сгенерировать" with sparkle icon
- Or if has results: "Смотреть результат (23)"

STYLE:
- Dark mode
- Green progress when ready (5+ photos)
- Pink/coral accent buttons
- Glassmorphism cards
- Russian text
- 9:16 mobile aspect ratio

QUALITY: 4K render, Figma-quality mockup
```

---

## Сводка экранов для генерации:

| # | Экран | Аспект | Ключевые элементы |
|---|-------|--------|-------------------|
| 1 | Onboarding | 9:16 | Orbital photos, neon logo, "Начать!" |
| 2 | Dashboard | 9:16 | "Мои аватары", tier cards, empty state |
| 3 | Upload | 9:16 | Photo grid, progress bar, tips card |
| 4 | Tier Select | 9:16 | 3 tier cards, prices in RUB |
| 5 | Payment Modal | 9:16 | Bottom sheet, 3 payment methods |
| 6 | Results | 9:16 | Gallery, progress, skeletons |
| 7 | Avatar Detail | 9:16 | Reference photos, generate button |

---

## Цветовая палитра (OKLCH):
- Primary: oklch(0.70 0.16 350) - Coral Pink #FF6B6B
- Accent: oklch(0.65 0.18 290) - Purple
- Success: Green for progress
- Warning: Yellow/Amber for tips
- TON Blue: #0098EA
- Stars Yellow: Amber/Gold
