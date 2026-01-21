/**
 * PinGlass Light Mode + Prompts Admin Mockups Generator
 *
 * Generates:
 * - 15 light mode versions of mobile app screens
 * - 1 new unified Prompts admin screen
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const KIE_API_KEY = process.env.KIE_AI_API_KEY || '2071514ba10ab85802e67750063f9c94';

// Brand style constants for consistency
const BRAND_STYLE = `
BRAND COLORS:
- Primary: Pink (#FF6B6B)
- Gradient: Pink-to-purple (from-pink-500 to-purple-500)
- Accent: Coral (#FF8E53)
- Success: Green
- Error: Red

DESIGN STYLE:
- Modern, clean, minimalist
- Rounded corners (rounded-2xl, rounded-xl)
- Soft shadows (shadow-lg)
- Premium feel with subtle gradients
- Russian text labels

LIGHT MODE PALETTE:
- Background: White (#FFFFFF) to slate-50 (#F8FAFC)
- Cards: White with subtle border (border-slate-200)
- Text primary: Slate-800 (#1E293B)
- Text secondary: Slate-500 (#64748B)
- Inputs: Slate-50 background with border
`;

// Light mode mobile screens (01-15)
const lightModeScreens = [
  {
    name: "01-onboarding-light",
    prompt: `Premium mobile app UI mockup, LIGHT MODE onboarding screen for AI photo generation app "PinGlass".

${BRAND_STYLE}

BACKGROUND: Light gradient (white to slate-50)

CENTER CONTENT:
- Orbital animation with 6 AI-generated portrait photos floating in circular orbit
- Photos show diverse people: business portraits, lifestyle shots
- Subtle pink glow trails connecting orbiting photos

BOTTOM SECTION:
- App logo: "PinGlass" in gradient text (pink to purple)
- Tagline: "Создавай профессиональные фото с помощью AI"
- Large pink gradient button "Начать!" with rounded-xl corners
- Home indicator bar at bottom

STYLE: Light mode, premium onboarding, pink accent, Russian text.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K Figma export quality mockup.`
  },
  {
    name: "02-dashboard-light",
    prompt: `Premium mobile app UI mockup, LIGHT MODE dashboard/pricing screen for AI photo app "PinGlass".

${BRAND_STYLE}

HEADER: "Тарифы" title centered, back arrow left

PRICING CARDS ROW (3 cards, horizontal scroll):
- Card 1 (slate-100 bg): "7" large number, "ФОТО", "499 ₽" price
- Card 2 (pink-100 bg, SELECTED): "15" large number, "ФОТО", "999 ₽" price, red "Хит" badge
- Card 3 (purple-100 bg): "23" large number, "ФОТО", "1499 ₽" price

FEATURES LIST (white cards with icons):
- ✓ "До 23 фото" - checkmark icon
- ✓ "Фото на сохранение" - shield icon
- ✓ "Безопасно" - lock icon

BOTTOM: Pink gradient button "Создать" with rounded-xl
- Text below: "Нужно ещё 3 фото"

NAVIGATION BAR: Home (active, pink), Gallery, Settings icons

STYLE: Light mode, clean pricing UI, pink accent.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K mockup.`
  },
  {
    name: "03-upload-light",
    prompt: `Premium mobile app UI mockup, LIGHT MODE photo upload screen for AI photo app "PinGlass".

${BRAND_STYLE}

HEADER: Back arrow, "Загрузка фото" title, X close button

PHOTO GRID (4x3 grid):
- 6 uploaded photos showing portrait selfies (diverse people)
- 3 empty slots with "+" dashed border (slate-200)
- Each photo has small X delete button in corner
- Subtle shadow on uploaded photos

UPLOAD PROGRESS: "6/10 фото загружено" with progress bar (60% pink fill)

INSTRUCTIONS CARD (white bg, rounded-xl):
- Icon: Camera with sparkles
- Text: "Загрузите 5-10 фотографий вашего лица"
- Subtext: "Разные ракурсы улучшат результат"

BOTTOM: Pink gradient button "Продолжить" (disabled state if < 5 photos)

STYLE: Light mode, upload interface, pink accent, Russian text.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K mockup.`
  },
  {
    name: "04-tier-select-light",
    prompt: `Premium mobile app UI mockup, LIGHT MODE tier/package selection for AI photo app "PinGlass".

${BRAND_STYLE}

HEADER: Back arrow, "Выбор пакета" title

SELECTED TIER CARD (large, white bg with pink border):
- "PREMIUM" label in purple
- Large "23" number with "фотографий" text
- Price: "1499 ₽" with strikethrough "85 ₽/фото"
- Badge: "Максимум возможностей"
- Checkmark icon (pink)

FEATURES LIST:
- ✓ "23 профессиональных фото"
- ✓ "3 стиля на выбор"
- ✓ "Приоритетная генерация"
- ✓ "Сохранение в облаке"

OTHER TIERS (smaller cards):
- "7 фото - 499 ₽"
- "15 фото - 999 ₽"

BOTTOM: Pink gradient button "Оплатить и получить 23 фото"
- Secure payment icons below (Visa, Mastercard, Mir)

STYLE: Light mode, tier selection, pink/purple accent.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K mockup.`
  },
  {
    name: "05-payment-modal-light",
    prompt: `Premium mobile app UI mockup, LIGHT MODE payment modal for AI photo app "PinGlass".

${BRAND_STYLE}

BACKGROUND: Blurred light app screen behind

MODAL (white card, rounded-3xl, shadow-2xl):

HEADER:
- Green checkmark badge "Безопасная оплата"
- X close button

ORDER SUMMARY:
- Pink icon with "15 фотографий" text
- "Выбранный пакет" label
- Price: "999 ₽" large

FORM FIELDS:
- "Email для чека" label
- Email input (slate-50 bg): "your@email.com" placeholder

PAYMENT BUTTONS (vertical stack):
- Primary: Pink gradient "Оплатить картой 999 ₽" with card icon
- Secondary: White border "Оплатить в Stars" with ⭐ icon
- Tertiary: Blue gradient "Оплатить в TON" with 💎 icon

FOOTER: "Данные защищены" with lock icon, gray text

STYLE: Light mode, payment modal, multi-provider.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K mockup.`
  },
  {
    name: "06-results-generating-light",
    prompt: `Premium mobile app UI mockup, LIGHT MODE generation progress screen for AI photo app.

${BRAND_STYLE}

HEADER: Back arrow, "AI генерация" title, progress "12 / 23 фото"

MAIN CONTENT:
- Large circular progress indicator with pink gradient fill
- Center: Sparkles icon animating
- Progress percentage: "52%"
- Status text: "Создаём ваши фото..."

PREVIEW GRID (2x3, partially filled):
- 6 generated photos showing AI portraits (business style)
- Remaining slots show loading shimmer effect
- Each completed photo has subtle checkmark

INFO CARD (white bg, rounded-xl):
- Clock icon
- "Можете закрыть приложение — пришлём фото в Telegram"

PROGRESS BAR: Pink gradient, "12/23 фото готово"

STYLE: Light mode, generation progress, pink accent.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K mockup.`
  },
  {
    name: "07-results-complete-light",
    prompt: `Premium mobile app UI mockup, LIGHT MODE results gallery for AI photo app "PinGlass".

${BRAND_STYLE}

HEADER: Back arrow, "Completed AI Photos" title

PHOTO GALLERY (4x6 grid, 23 photos visible):
- Professional AI-generated portraits
- Mix of business and lifestyle styles
- Men and women, diverse
- Each photo has subtle shadow and rounded corners

SELECTED PHOTO: One photo highlighted with pink border

ACTION BUTTONS ROW:
- "Сгенерировать ещё" pink gradient button with sparkles icon
- Share icon button
- Download icon button

STATS BAR: "23 фото • 15 янв 2026"

BOTTOM NAVIGATION: Home, Gallery (active, pink), Settings

STYLE: Light mode, photo gallery, professional results.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K mockup.`
  },
  {
    name: "08-admin-login-light",
    prompt: `Premium desktop web app UI mockup, LIGHT MODE admin login for "PinGlass Admin".

${BRAND_STYLE}

FULL SCREEN: Light gradient background (slate-50 via white to slate-100)

CENTER CARD (white, max-width 400px, shadow-xl, rounded-2xl):

HEADER:
- Bold "PinGlass Admin" text (slate-800)
- Subtitle "Панель администрирования" (slate-500)

FORM:
- Email input with Mail icon, placeholder "admin@example.com"
- Password input with Lock icon and Eye toggle
- Inputs have slate-50 bg, rounded-xl, border-slate-200

BUTTON: Pink-to-purple gradient "Войти", rounded-xl, shadow-lg

FOOTER: "Вход только для администраторов" gray text

STYLE: Light mode, admin login, clean professional design.
ASPECT: 16:9 desktop landscape.
QUALITY: 4K mockup.`
  },
  {
    name: "09-admin-dashboard-light",
    prompt: `Premium desktop web app UI mockup, LIGHT MODE admin dashboard for "PinGlass Admin".

${BRAND_STYLE}

HEADER BAR (white bg, border-b, sticky):
- Logo "PinGlass" gradient text
- Nav tabs: Dashboard (active, pink underline), Users, Payments, Generations, Prompts, Referrals, Partners, Telegram, Support, Logs, Settings

MAIN CONTENT (slate-50 bg):

TITLE: "Dashboard" h2 + "Обновлено: 14:32:15" + blue "Обновить" button

KPI CARDS (4 white cards, shadow-sm):
- Users: "1,247" total, "42 Pro", "+3.2% конверсия"
- Revenue: "847,500₽ / 12,450⭐ / 45.2 TON", "Сегодня: 23,400₽"
- Avg check: "892 ₽", conversion rate
- Generations: "3,842" total, "12 в очереди"

PROVIDER CARDS (3 cards):
- T-Bank (red-50): "487,500 ₽", "156 платежей"
- Stars (yellow-50): "12,450 ⭐", "89 платежей"
- TON (blue-50): "45.2 TON", "34 платежей"

CHARTS (2 white cards):
- Revenue line chart with pink gradient
- Pie chart "Распределение тарифов"

STYLE: Light mode professional dashboard.
ASPECT: 16:9 desktop.
QUALITY: 4K mockup.`
  },
  {
    name: "10-admin-users-light",
    prompt: `Premium desktop web app UI mockup, LIGHT MODE admin users table for "PinGlass Admin".

${BRAND_STYLE}

HEADER: Same nav with "Users" tab active

MAIN CONTENT:

TITLE ROW: "Пользователи" + Search input + "Обновить" button

STATS: Total "1,247", Pro "42", Partners "12" badges

DATA TABLE (white bg, rounded-xl):
Headers: ID, Telegram, Username, Статус, Аватары, Платежи, Потрачено, Telegram, Дата

ROWS:
- #1247, @user1, "Пользователь", 3, 2, "2,498₽", green badge, "15.01"
- #1246, @designer, purple "Partner" badge, 5, 4, "5,996₽", green, "14.01"
- #1245, @test, "Пользователь", 1, 1, "499₽", yellow "Ожидает", "14.01"
- #1244, @photo_lover, "Пользователь", 2, 3, "3,497₽", green, "13.01"
- #1243, @banned, red "Заблокирован", 0, 0, "0₽", red badge, "12.01"

PAGINATION: "< Prev 1 2 3 ... 42 Next >"

STYLE: Light mode, clean table, colored badges.
ASPECT: 16:9 desktop.
QUALITY: 4K mockup.`
  },
  {
    name: "11-admin-payments-light",
    prompt: `Premium desktop web app UI mockup, LIGHT MODE admin payments for "PinGlass Admin".

${BRAND_STYLE}

HEADER: Nav with "Payments" active

TITLE ROW: "Платежи" + Filter dropdowns + Date picker + "Обновить"

PROVIDER SUMMARY (3 inline cards):
- T-Bank: "156 успешных • 487,500₽"
- Stars: "89 успешных • 12,450⭐"
- TON: "34 успешных • 45.2 TON"

DATA TABLE (white bg):
Headers: ID, Пользователь, Тариф, Сумма, Провайдер, Статус, Дата, Действия

ROWS:
- #892, @user1, "15 фото" yellow badge, "999₽", "🏦 T-Bank", green "Успешно", "15.01", Eye
- #891, @user2, "23 фото" purple, "1,499₽", "🏦 T-Bank", green, "15.01", Eye
- #890, @user3, "7 фото" gray, "499₽", "⭐ Stars", green, "15.01", Eye
- #889, @user4, "15 фото", "~15 TON", "💎 TON", green, "15.01", Eye
- #888, @user5, "15 фото", "999₽", "🏦 T-Bank", yellow "Создание...", "15.01", Eye

STYLE: Light mode, payments table, provider icons.
ASPECT: 16:9 desktop.
QUALITY: 4K mockup.`
  },
  {
    name: "12-admin-generations-light",
    prompt: `Premium desktop web app UI mockup, LIGHT MODE admin generations monitoring for "PinGlass Admin".

${BRAND_STYLE}

HEADER: Nav with "Generations" active

TITLE ROW: "Генерации" + Status filter + Toggle "Авто-обновление" (green) + "Обновить"

STATS CARDS (4 cards inline):
- "3,842 всего" (gray)
- "3,654 завершено" (green with CheckCircle)
- "42 в процессе" (yellow with Loader)
- "146 ошибок" (red with XCircle)

DATA TABLE:
Headers: ID, Пользователь, Тариф, Прогресс, Статус, Время, Дата, Действия

ROWS with progress bars:
- #1892, @user1, "23 фото", 87% bar (20/23), green "В процессе", "12 мин", Eye + Retry
- #1891, @user2, "15 фото", 100% bar, green "Завершено", "8 мин", Eye
- #1890, @user3, "7 фото", 100% bar, green "Завершено", "4 мин", Eye
- #1889, @user4, "23 фото", 0% bar, yellow "В очереди", "-", Eye
- #1888, @user5, "15 фото", 40% red bar, red "Ошибка", "5 мин", Eye + Retry

Progress bars: Pink gradient fill

STYLE: Light mode, monitoring dashboard.
ASPECT: 16:9 desktop.
QUALITY: 4K mockup.`
  },
  {
    name: "13-auth-modal-light",
    prompt: `Premium mobile app UI mockup, LIGHT MODE authentication modal for AI photo app.

${BRAND_STYLE}

BACKGROUND: Blurred light onboarding screen

MODAL (white card, rounded-3xl, shadow-2xl, centered):

CLOSE: X button top-right

HEADER:
- "Вход в аккаунт" title (slate-800)
- "Войдите, чтобы продолжить" subtitle (slate-500)

GOOGLE BUTTON:
- White bg with border
- Google "G" logo (4 colors)
- "Продолжить с Google" text

DIVIDER: Line with "или" text

FORM:
- Email input with Mail icon, placeholder "you@example.com"
- Password input with Lock icon, Eye toggle

SUBMIT: Pink gradient button "Войти"

FOOTER: "Нет аккаунта? Зарегистрироваться" (pink link)

STYLE: Light mode, auth modal, clean design.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K mockup.`
  },
  {
    name: "14-payment-callback-light",
    prompt: `Premium mobile app UI mockup, LIGHT MODE payment success screen.

${BRAND_STYLE}

BACKGROUND: Light gradient (white to slate-50)

CENTER CONTENT:
- Large green checkmark in circle with soft glow
- "Оплата успешна!" title (slate-800, bold)
- "Ваш заказ на 15 фото оформлен" subtitle (slate-500)

ORDER CARD (white, rounded-xl, shadow-lg):
- "Заказ #892" header
- "Тариф: 15 фотографий"
- "Сумма: 999 ₽"
- "Метод: T-Bank"
- Green "Оплачено" badge

INFO TEXT: "Генерация уже началась! Мы пришлём фото в Telegram."

BOTTOM: Pink gradient button "Перейти к генерации" with Sparkles icon

STYLE: Light mode, success state, green accent.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K mockup.`
  },
  {
    name: "15-error-modal-light",
    prompt: `Premium mobile app UI mockup, LIGHT MODE error modal.

${BRAND_STYLE}

BACKGROUND: Blurred light app screen

MODAL (bottom sheet, white, rounded-t-3xl, shadow-2xl):

HEADER:
- Red AlertCircle icon
- "Произошла ошибка" title (slate-800)

MESSAGE:
- "Не удалось выполнить операцию. Пожалуйста, попробуйте ещё раз." (slate-600)

ERROR CODE: "Код ошибки: GEN_TIMEOUT_001" (monospace, slate-400)

BUTTONS:
- Primary: Pink gradient "Попробовать снова" with RotateCcw icon
- Secondary: White border "Связаться с поддержкой" with MessageSquare icon
- Tertiary: "Закрыть" text button (slate-500)

STYLE: Light mode, error modal, clean design.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K mockup.`
  }
];

// NEW: Unified Prompts Admin Screen
const promptsAdminScreen = {
  name: "16-admin-prompts-unified",
  prompt: `Premium desktop web app UI mockup, LIGHT MODE unified Prompts management page for "PinGlass Admin".

${BRAND_STYLE}

HEADER BAR: Same nav with "Prompts" tab active (Sparkles icon, pink underline)

MAIN CONTENT (3-column layout on slate-50 bg):

=== LEFT COLUMN (40% width) - PROMPT TESTER ===

SECTION TITLE: "Тестер промптов" with Beaker icon

REFERENCE PHOTOS AREA (white card, rounded-xl):
- Title: "Референсные фото" with info tooltip
- Upload zone: Dashed border, "Загрузите 5-10 фото" text, Plus icon
- Photo grid (3x2): 6 uploaded portrait photos with X delete buttons
- Progress: "6/10 фото" with pink progress bar
- Status badge: Green "Готово к тестированию"

PROMPT INPUT CARD (white card, rounded-xl):
- Label: "Промпт" with required asterisk
- Large textarea (6 rows): "Professional business portrait of {subject}, wearing formal attire, corporate office background, soft studio lighting, 8k quality"
- Character count: "156/500"
- Label: "Negative prompt" (optional)
- Smaller textarea: "blurry, low quality, distorted face, extra limbs"

GENERATION SETTINGS ROW:
- "Количество фото:" dropdown showing "3"
- "Стиль:" dropdown showing "Professional"

ACTION BUTTONS ROW:
- Primary: Pink gradient "🧪 Тестировать" button (large)
- Secondary: "💾 Сохранить промпт" outline button
- Tertiary: "📦 Добавить в пак" outline button

RESULT PREVIEW (white card, appears after generation):
- Title: "Результат тестирования"
- 3 generated portrait photos in horizontal row
- Generation time: "⏱ 12.3 сек"
- Status: Green "Успешно" badge
- Quick actions: "Использовать этот промпт" link

=== CENTER COLUMN (30% width) - SAVED PROMPTS ===

SECTION TITLE: "Сохранённые промпты" with BookMarked icon, count "(23)"

SEARCH: Input with magnifier icon, placeholder "Поиск промптов..."

FILTER CHIPS: "Все", "⭐ Избранные", "Professional", "Lifestyle", "Creative"

PROMPTS LIST (scrollable, white cards):

PROMPT CARD 1 (selected, pink border):
- Star icon (yellow, favorite)
- Name: "Business Portrait v2"
- Preview: Small thumbnail image
- Tags: "professional", "corporate" badges
- Last used: "2 дня назад"
- Actions: Edit, Copy, Delete icons

PROMPT CARD 2:
- Name: "Casual Lifestyle"
- Tags: "lifestyle", "outdoor"
- Preview thumbnail
- Last used: "5 дней назад"

PROMPT CARD 3:
- Name: "Creative Neon"
- Tags: "creative", "neon"
- Preview thumbnail
- Last used: "1 неделю назад"

More cards with scroll indicator...

=== RIGHT COLUMN (30% width) - PHOTO PACKS ===

SECTION TITLE: "Фотопаки" with Folder icon, count "(8)"

CREATE BUTTON: "+ Создать пак" pink outline button

PACKS LIST (white cards):

PACK CARD 1 (expanded):
- Cover image (collage of 4 photos)
- Name: "Бизнес портреты"
- Description: "Профессиональные фото для LinkedIn"
- Items count: "12 промптов"
- Status: Green "Активен" badge
- Expand arrow showing pack contents:
  - List of 3 prompts inside with drag handles
  - "Professional CEO", "Office Worker", "Startup Founder"
- Actions: Edit, Duplicate, Archive icons

PACK CARD 2 (collapsed):
- Cover thumbnail
- Name: "Лайфстайл"
- "8 промптов"
- Active badge

PACK CARD 3 (collapsed):
- Name: "Креатив"
- "15 промптов"
- Gray "Черновик" badge

ADD TO PACK MODAL (floating, if triggered):
- Title: "Добавить в фотопак"
- Pack selection dropdown
- Position in pack number input
- "Добавить" and "Отмена" buttons

STYLE: Light mode, professional admin interface, 3-column layout, pink accent (#FF6B6B).
ASPECT: 16:9 desktop landscape.
QUALITY: 4K admin dashboard mockup with detailed UI elements.`
};

// Combine all screens
const allScreens = [...lightModeScreens, promptsAdminScreen];

async function createTask(screen) {
  return new Promise((resolve, reject) => {
    const aspectRatio = screen.name.includes('admin') ? '16:9' : '9:16';

    const data = JSON.stringify({
      model: 'nano-banana-pro',
      input: {
        prompt: screen.prompt,
        aspect_ratio: aspectRatio
      }
    });

    const options = {
      hostname: 'api.kie.ai',
      path: '/api/v1/jobs/createTask',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve({ screen: screen.name, result });
        } catch(e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function generateAll() {
  console.log(`\n🎨 Generating ${allScreens.length} PinGlass Light Mode mockups...\n`);
  console.log(`   - 15 light mode mobile/admin screens`);
  console.log(`   - 1 unified Prompts admin screen\n`);

  const results = [];

  for (const screen of allScreens) {
    const aspectRatio = screen.name.includes('admin') ? '16:9' : '9:16';
    console.log(`📸 Creating: ${screen.name} (${aspectRatio})`);

    try {
      const result = await createTask(screen);
      const taskId = result.result.data?.taskId || result.result.data?.task_id;
      console.log(`   ✅ Task ID: ${taskId || 'unknown'}`);

      if (taskId) {
        results.push({
          name: screen.name,
          taskId: taskId
        });
      }
    } catch(e) {
      console.log(`   ❌ Error: ${e.message}`);
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }

  // Save task IDs
  const outputPath = path.join(__dirname, '..', 'NewDesign', 'pinglass-light-tasks.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Task IDs saved to: ${outputPath}`);

  console.log('\n=== Generated Tasks ===');
  results.forEach(r => console.log(`${r.name}: ${r.taskId}`));

  console.log('\n📋 Run poll script to download results:');
  console.log('   node scripts/poll-light-mockups.js');

  return results;
}

generateAll();
