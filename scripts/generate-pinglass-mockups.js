/**
 * PinGlass Screen Mockup Generator v2
 * Generates accurate UI mockups based on real app content
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const KIE_API_KEY = process.env.KIE_AI_API_KEY || '2071514ba10ab85802e67750063f9c94';

// Точные промпты на основе реального контента PinGlass
const screens = [
  {
    name: "01-onboarding",
    prompt: `Premium mobile app UI mockup screenshot, dark mode onboarding welcome screen for AI photo generation app called Pinglass.

CENTER: Large glowing neon pink logo text "Pinglass" with holographic shine effect.
BELOW LOGO: Russian subtitle text "Создавайте впечатляющие AI-фотографии"
ORBITAL ANIMATION: 11 small floating portrait photos arranged in 2 circular orbits around the center logo. Inner ring has 4 photos, outer ring has 6 photos. Photos have glassmorphism frames with neon glow.
BOTTOM: Large gradient button coral-pink to orange with text "Начать!" and sparkle icon.
BACKGROUND: Deep purple to black gradient with subtle floating blur orbs.

STYLE: iOS 18 design language, glassmorphism, neon glow effects, premium AI app aesthetic.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K Figma export quality, pixel-perfect UI mockup.`
  },
  {
    name: "02-dashboard",
    prompt: `Premium mobile app UI mockup screenshot, dark mode dashboard screen for AI photo app Pinglass.

TOP HEADER: Bold white title "Мои аватары" (Russian for My Avatars).
SUBTITLE: Gray text "Создавайте AI-фотографии в стиле PINGLASS"

MAIN CONTENT - EMPTY STATE:
Large dashed-border card with gradient background. Inside: Plus icon in rounded square, title "Создать первый аватар", description "Загрузите 5-8 своих фото и получите до 23 профессиональных портрета".

SECTION "Тарифы" (Pricing):
3 small cards in horizontal row:
- Card 1: "7" large number, "фото" label, "499 ₽" price
- Card 2: "15" large number, "фото" label, "999 ₽" price, pink "Хит" badge with star
- Card 3: "23" large number, "фото" label, "1499 ₽" price

BOTTOM FEATURES: 2 cards side by side:
- Left card: Lightning bolt icon, "До 23 фото", "На выбор"
- Right card: Shield icon (green), "Безопасно", "Фото не сохраняются"

STYLE: Dark mode, glassmorphism cards, coral pink accents (#FF6B6B), Russian text.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K Figma mockup quality.`
  },
  {
    name: "03-upload",
    prompt: `Premium mobile app UI mockup screenshot, dark mode photo upload screen for AI photo app.

TOP BAR: Back arrow, editable text field "Название аватара...", progress bar showing green "5/8 фото" with checkmark icon.

TIPS CARD (yellow/amber background):
Camera icon, title "Советы для лучшего результата", bullet list in Russian:
- Хорошее освещение лица
- Разные ракурсы и выражения
- Без солнечных очков и головных уборов

PHOTO GRID (3 columns):
- First cell: Dashed border with Plus icon and "Добавить" text
- 5 cells: Uploaded selfie photos with small X delete buttons in top-right corner
- 2-3 cells: Gray skeleton placeholders with faint Plus icons

FIXED BOTTOM BAR:
Gradient pink-to-orange button with sparkle icon and text "Создать".
Below button: Gray text "Нужно ещё 3 фото"

STYLE: Dark mode, yellow info card, green progress, pink button, rounded photos.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K UI mockup.`
  },
  {
    name: "04-tier-select",
    prompt: `Premium mobile app UI mockup screenshot, dark mode pricing tier selection screen for AI photo app.

TOP: Back arrow, heading "Выберите пакет" (Choose Package), subtitle "PINGLASS"

3 LARGE TIER CARDS (vertical stack, radio button style):

CARD 1 - STARTER:
- Left: Large "7" number in rounded square icon (gray background)
- Title: "7 фотографий"
- Price: "499 ₽" with "71 ₽/фото"
- Description: "Попробовать AI-фото"

CARD 2 - STANDARD (SELECTED):
- Left: Large "15" number in pink gradient rounded square
- Title: "15 фотографий" + Star badge "Хит" in gold
- Price: "999 ₽" with "67 ₽/фото"
- Description: "Оптимальный выбор"
- Pink gradient border, checkmark icon + "Выбрано" text
- Card has subtle pink glow shadow

CARD 3 - PREMIUM:
- Left: Large "23" number in rounded square icon (gray background)
- Title: "23 фотографий"
- Price: "1499 ₽" with "65 ₽/фото"
- Description: "Максимум возможностей"

FIXED BOTTOM:
Gradient pink button "Оплатить и получить 15 фото" with sparkle icon.

STYLE: Dark glassmorphism, pink selection highlight (#FF6B6B), Russian and Rubles.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K Figma mockup.`
  },
  {
    name: "05-payment-modal",
    prompt: `Premium mobile app UI mockup screenshot, payment bottom sheet modal over dark blurred background.

MODAL (bottom sheet, rounded top corners, dark glassmorphism):

HEADER ROW:
- Green shield icon with checkmark
- Title "Безопасная оплата" (Secure Payment)
- X close button on right

SELECTED TIER CARD:
- Image icon in pink background square
- "15 фотографий" title
- "Выбранный пакет" subtitle
- "999 ₽" large price on right

EMAIL INPUT SECTION:
- Mail icon + label "Email для чека"
- Text input field with placeholder "your@email.com"

3 PAYMENT BUTTONS (vertical stack):

BUTTON 1 - CARD (primary):
- Orange-coral gradient (#FF6B6B to #FF8E53)
- Credit card icon + "Оплатить картой 999 ₽"

BUTTON 2 - TELEGRAM STARS:
- White background with yellow/amber border
- Filled star icon (amber/gold)
- "Оплатить в Stars"

BUTTON 3 - TON CRYPTO:
- Blue background (#0098EA)
- Coins icon + "Оплатить в TON"

BACKGROUND: Blurred dark app screen with 50% black overlay.

STYLE: Dark glassmorphism modal, multi-payment options, Russian text.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K modal mockup.`
  },
  {
    name: "06-results-generating",
    prompt: `Premium mobile app UI mockup screenshot, dark mode AI photo generation results screen showing progress.

TOP BAR:
- Back arrow button
- Pink badge "12 / 23 фото" showing generation progress

PROGRESS CARD (glassmorphism with subtle pink gradient):
- Sparkles icon with pulse animation
- Title "AI генерация"
- Progress bar: Pink gradient (#FF6B6B), 52% filled
- Stats row: "12 / 23 фото" left, "~6 мин" right in gray pill
- Bottom text: "Можете закрыть приложение — пришлём фото в Telegram"

PHOTO GALLERY (2-column masonry grid):
- 12 completed AI-generated portrait photos (high quality professional headshots)
- Photos have rounded corners (20px), 3:4 aspect ratio
- 11 skeleton loading placeholders with centered spinner icons
- Placeholders have subtle gradient overlay

STYLE: Dark mode, pink progress accents, professional AI portraits, skeleton loading states.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K gallery mockup with realistic AI portrait thumbnails.`
  },
  {
    name: "07-results-complete",
    prompt: `Premium mobile app UI mockup screenshot, dark mode completed results gallery for AI photo app.

TOP BAR:
- Back arrow button
- No progress badge (generation complete)

PHOTO GALLERY (2-column masonry grid, full screen):
- 23 high-quality AI-generated portrait photos
- Diverse professional styles: business headshots, casual lifestyle, creative artistic
- Photos have rounded corners, 3:4 aspect ratio
- Subtle shadow on each photo card

BOTTOM FLOATING BUTTON:
- Gradient pink button "Сгенерировать ещё" (Generate More) with sparkle icon
- Or download/share action buttons

STYLE: Dark mode, premium photo gallery aesthetic, professional AI portraits.
ASPECT: 9:16 mobile portrait.
QUALITY: 4K gallery mockup with realistic diverse AI portrait thumbnails.`
  }
];

async function createTask(screen) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'nano-banana-pro',
      input: {
        prompt: screen.prompt,
        aspect_ratio: '9:16'
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
  console.log(`\n🎨 Generating ${screens.length} PinGlass screen mockups via Nano Banana Pro...\n`);

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
  const outputPath = path.join(__dirname, '..', 'NewDesign', 'pinglass-v2-tasks.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Task IDs saved to: ${outputPath}`);

  console.log('\n=== Task IDs ===');
  results.forEach(r => console.log(`${r.name}: ${r.taskId}`));

  console.log('\n📋 Run poll script to download results:');
  console.log('   node scripts/poll-pinglass-mockups.js');
}

generateAll();
