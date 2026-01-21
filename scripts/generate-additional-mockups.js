/**
 * PinGlass Additional Mockups Generator
 * Generates Admin Panel and other missing screens
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const KIE_API_KEY = process.env.KIE_AI_API_KEY || '2071514ba10ab85802e67750063f9c94';

// Admin Panel screens - LIGHT MODE, Desktop aspect ratio
const screens = [
  {
    name: "08-admin-login",
    prompt: `Premium desktop web app UI mockup, LIGHT MODE admin login page for "PinGlass Admin" panel.

LAYOUT:
- Full screen light gradient background (slate-50 via white to slate-100)
- Center: White card (max-width 400px) with shadow-xl, rounded-2xl corners

CARD CONTENT:
- TOP: Bold text "PinGlass Admin" (slate-800), subtitle "Панель администрирования" (slate-500)
- ERROR ALERT (optional): Red box with AlertCircle icon, Russian error text
- FORM:
  - Email input with Mail icon (placeholder "admin@example.com")
  - Password input with Lock icon and Eye toggle button
  - Inputs have slate-50 background, rounded-xl
- BUTTON: Pink-to-purple gradient (from-pink-500 to-purple-500), text "Войти", rounded-xl, shadow-lg
- FOOTER: Gray text "Вход только для администраторов"

STYLE: Light mode, clean design, pink accent color (#FF6B6B), Russian text.
ASPECT: 16:9 desktop landscape.
QUALITY: 4K Figma export quality, pixel-perfect UI mockup.`
  },
  {
    name: "09-admin-dashboard",
    prompt: `Premium desktop web app UI mockup, LIGHT MODE admin dashboard for "PinGlass Admin" panel.

HEADER BAR (sticky, white bg, border-b):
- Logo "PinGlass" with gradient text (pink to purple)
- Navigation tabs: Dashboard (active, pink underline), Users, Payments, Generations, Prompts, Referrals, Partners, Telegram, Support, Logs, Settings
- Icons: LayoutDashboard, Users, DollarSign, Zap, Sparkles, Gift, Crown, MessageSquare, Ticket, Activity, Settings

MAIN CONTENT (bg-slate-50, padding):

TITLE ROW: "Dashboard" h2 bold + "Обновлено: 14:32:15" + blue "Обновить" button with RefreshCw icon

KPI CARDS ROW (4 cards, white bg, rounded-xl, shadow-sm):
- Card 1: Users icon, "Пользователи", "1,247", "42 Pro", trend "3.2% конверсия"
- Card 2: CreditCard icon (green), "Выручка MTD", "847,500₽ / 12,450⭐ / 45.2 TON", "Сегодня: 23,400₽"
- Card 3: TrendingUp icon (blue), "Средний чек", "892 ₽", "3.2% конверсия (RUB)"
- Card 4: Zap icon (purple), "Генерации", "3,842", "12 в очереди"

PROVIDER STATS ROW (3 cards):
- T-Bank card (red-50 bg): 🏦 icon, "T-Bank", "487,500 ₽", "156 платежей"
- Stars card (yellow-50 bg): ⭐ icon, "Telegram Stars", "12,450 ⭐", "89 платежей"
- TON card (blue-50 bg): 💎 icon, "TON", "45.2 TON", "34 платежей"

CHARTS ROW (2 charts, white bg, rounded-xl):
- Left: Line chart "Выручка за 30 дней" with pink gradient fill
- Right: Pie chart "Распределение тарифов" with 3 segments (7/15/23 фото)

STYLE: Light mode professional dashboard, pink (#FF6B6B) accent, Russian text, clean data visualization.
ASPECT: 16:9 desktop landscape.
QUALITY: 4K admin dashboard mockup.`
  },
  {
    name: "10-admin-users",
    prompt: `Premium desktop web app UI mockup, LIGHT MODE admin users table for "PinGlass Admin" panel.

HEADER: Same as dashboard with "Users" tab active (pink underline)

MAIN CONTENT:

TITLE ROW: "Пользователи" h2 + Search input with magnifier icon + "Обновить" button

STATS BAR: Total users badge, Pro users count, Partners badge

DATA TABLE (white bg, rounded-xl, shadow-sm):
TABLE HEADER: ID, Telegram, Username, Статус, Аватары, Платежи, Потрачено, Telegram, Дата

TABLE ROWS (5-6 visible rows):
- Row 1: #1247, @username1, "Пользователь", 3 avatars, 2 payments, "2,498 ₽", green "Отправлено" badge, "15.01.2025"
- Row 2: #1246, @designer_pro, purple "Partner" badge, 5 avatars, 4 payments, "5,996 ₽", green badge, "14.01.2025"
- Row 3: #1245, @user_test, "Пользователь", 1 avatar, 1 payment, "499 ₽", yellow "Ожидает" badge, "14.01.2025"
- Row 4: #1244, @photo_lover, "Пользователь", 2 avatars, 3 payments, "3,497 ₽", green badge, "13.01.2025"
- Row 5: #1243, @banned_user, red "Заблокирован" badge, 0 avatars, 0 payments, "0 ₽", red "Ошибка" badge, "12.01.2025"

PAGINATION: "< Prev" "1 2 3 ... 42" "Next >"

STYLE: Light mode, clean table design, colored status badges, Russian text.
ASPECT: 16:9 desktop landscape.
QUALITY: 4K admin table mockup.`
  },
  {
    name: "11-admin-payments",
    prompt: `Premium desktop web app UI mockup, LIGHT MODE admin payments view for "PinGlass Admin" panel.

HEADER: Same nav with "Payments" tab active

MAIN CONTENT:

TITLE ROW: "Платежи" h2 + Filter dropdowns (Статус, Тариф, Провайдер) + Date picker + "Обновить"

FILTER CHIPS: "Все статусы", "Все тарифы", "Все провайдеры"

PROVIDER SUMMARY CARDS (3 small cards inline):
- T-Bank: "156 успешных • 487,500 ₽"
- Stars: "89 успешных • 12,450 ⭐"
- TON: "34 успешных • 45.2 TON"

DATA TABLE (white bg, rounded-xl):
TABLE HEADER: ID, Пользователь, Тариф, Сумма, Провайдер, Статус, Дата, Действия

TABLE ROWS:
- Row 1: #892, @user1, "15 фото" yellow badge, "999 ₽", "🏦 T-Bank" badge, green "Успешно" badge, "15.01 14:32", Eye icon button
- Row 2: #891, @user2, "23 фото" purple badge, "1,499 ₽", "🏦 T-Bank" badge, green badge, "15.01 13:45", Eye icon
- Row 3: #890, @user3, "7 фото" gray badge, "499 ₽", "⭐ Stars" yellow badge, green badge, "15.01 12:20", Eye icon
- Row 4: #889, @user4, "15 фото" badge, "~15 TON", "💎 TON" blue badge, green badge, "15.01 11:55", Eye icon
- Row 5: #888, @user5, "15 фото" badge, "999 ₽", "🏦 T-Bank" badge, yellow "Создание..." badge, "15.01 11:30", Eye icon
- Row 6: #887, @user6, "7 фото" badge, "499 ₽", "🏦 T-Bank" badge, red "Отменён" badge, "15.01 10:15", Eye icon

PAGINATION at bottom

STYLE: Light mode, provider badges with icons, colored status pills, Russian text.
ASPECT: 16:9 desktop landscape.
QUALITY: 4K payments table mockup.`
  },
  {
    name: "12-admin-generations",
    prompt: `Premium desktop web app UI mockup, LIGHT MODE admin generations monitoring for "PinGlass Admin".

HEADER: Same nav with "Generations" tab active (Zap icon)

MAIN CONTENT:

TITLE ROW: "Генерации" h2 + Status filter + Date filter + Toggle "Авто-обновление" (green) + "Обновить"

STATS CARDS ROW (4 cards):
- Total: "3,842 всего"
- Completed: green "3,654 завершено" with CheckCircle
- Processing: yellow "42 в процессе" with Loader2 spinning
- Failed: red "146 ошибок" with XCircle

DATA TABLE (white bg):
TABLE HEADER: ID, Пользователь, Тариф, Прогресс, Статус, Время, Дата, Действия

TABLE ROWS:
- Row 1: #1892, @user1, "23 фото", progress bar 87% (20/23 photos), green "В процессе" badge, "12 мин", "15.01 14:32", Eye + RotateCcw buttons
- Row 2: #1891, @user2, "15 фото", progress bar 100% (15/15), green "Завершено" badge, "8 мин", "15.01 14:20", Eye button
- Row 3: #1890, @user3, "7 фото", progress bar 100% (7/7), green "Завершено" badge, "4 мин", "15.01 14:15", Eye button
- Row 4: #1889, @user4, "23 фото", progress bar 0% (0/23), yellow "В очереди" badge, "-", "15.01 14:10", Eye button
- Row 5: #1888, @user5, "15 фото", progress bar 40% with red X (6/15), red "Ошибка" badge, "5 мин", "15.01 13:50", Eye + RotateCcw buttons

Progress bars use pink gradient fill (#FF6B6B)

STYLE: Light mode, real-time monitoring aesthetic, progress indicators, Russian text.
ASPECT: 16:9 desktop landscape.
QUALITY: 4K generations monitoring mockup.`
  },
  {
    name: "13-auth-modal-web",
    prompt: `Premium mobile app UI mockup, DARK MODE authentication modal for AI photo app "Pinglass".

BACKGROUND: Dark blurred app screen (onboarding visible behind)

MODAL (centered, dark glassmorphism card, rounded-3xl, max-width 400px):

CLOSE BUTTON: X icon in top-right corner

HEADER:
- Title: "Вход в аккаунт" (or "Регистрация")
- Subtitle: "Войдите, чтобы продолжить"

GOOGLE BUTTON (primary):
- White background, rounded-xl
- Google "G" logo (4 colors)
- Text: "Продолжить с Google"
- Shadow effect

DIVIDER: Line with "или" text in center

FORM FIELDS:
- Name input (only for register): User icon + "Ваше имя" placeholder
- Email input: Mail icon + "you@example.com" placeholder
- Password input: Lock icon + "Ваш пароль" placeholder + Eye toggle

SUBMIT BUTTON:
- Pink-to-purple gradient (from-primary to oklch(0.65 0.20 340))
- Text: "Войти" or "Создать аккаунт"
- Rounded-xl

SWITCH MODE TEXT:
- "Нет аккаунта? Зарегистрироваться" (pink link)
- or "Уже есть аккаунт? Войти" (pink link)

STYLE: Dark glassmorphism, premium modal, pink accent (#FF6B6B), Russian text.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K modal mockup.`
  },
  {
    name: "14-payment-callback",
    prompt: `Premium mobile app UI mockup, DARK MODE payment success screen for AI photo app.

FULL SCREEN DARK BACKGROUND with subtle gradient

CENTER CONTENT:
- Large green checkmark icon in circle with glow effect
- Title: "Оплата успешна!" (large, white, bold)
- Subtitle: "Ваш заказ на 15 фото оформлен" (gray, muted)

ORDER DETAILS CARD (glassmorphism):
- "Заказ #892" header
- "Тариф: 15 фотографий"
- "Сумма: 999 ₽"
- "Метод: T-Bank"
- Green "Оплачено" badge

BOTTOM SECTION:
- Text: "Генерация уже началась! Мы пришлём фото в Telegram."
- Pink gradient button "Перейти к генерации" with Sparkles icon

STYLE: Dark mode, success state, green accent for checkmark, pink button, Russian text.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K success screen mockup.`
  },
  {
    name: "15-error-modal",
    prompt: `Premium mobile app UI mockup, DARK MODE error modal for AI photo app.

BACKGROUND: Dark blurred app screen

MODAL (bottom sheet style, dark glassmorphism, rounded-t-3xl):

HEADER:
- Red AlertCircle icon with subtle glow
- Title: "Произошла ошибка" (white, bold)

ERROR MESSAGE:
- Gray text: "Не удалось выполнить операцию. Пожалуйста, попробуйте ещё раз."
- Or specific: "Превышен лимит загрузки файлов"

ERROR CODE (optional):
- Small monospace text: "Код ошибки: GEN_TIMEOUT_001"

BUTTONS (vertical stack):
- Primary: Pink gradient button "Попробовать снова" with RotateCcw icon
- Secondary: Outline button "Связаться с поддержкой" with MessageSquare icon
- Tertiary: Text button "Закрыть" (gray)

STYLE: Dark glassmorphism, error state with red accent, Russian text.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K error modal mockup.`
  }
];

async function createTask(screen) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'nano-banana-pro',
      input: {
        prompt: screen.prompt,
        aspect_ratio: screen.name.includes('admin') ? '16:9' : '9:16'
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
  console.log(`\n🎨 Generating ${screens.length} additional PinGlass mockups...\n`);

  const results = [];
  for (const screen of screens) {
    console.log(`📸 Creating task: ${screen.name}`);
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
  }

  // Save task IDs
  const outputPath = path.join(__dirname, '..', 'NewDesign', 'pinglass-additional-tasks.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Task IDs saved to: ${outputPath}`);

  console.log('\n=== Task IDs ===');
  results.forEach(r => console.log(`${r.name}: ${r.taskId}`));

  console.log('\n📋 Run poll script to download results:');
  console.log('   node scripts/poll-additional-mockups.js');
}

generateAll();
