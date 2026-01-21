/**
 * PinGlass Design Mockup Generator
 * Uses Kie.ai API for high-quality UI mockup generation
 */

const KIE_API_KEY = process.env.KIE_AI_API_KEY;
const KIE_BASE_URL = 'https://api.kie.ai/v1';

interface GenerationTask {
  task_id: string;
  status: string;
  result?: {
    images: string[];
  };
}

// PinGlass Brand Prompt Templates
const PROMPT_TEMPLATES = {
  onboarding: `Professional mobile app UI mockup, onboarding welcome screen,
modern glassmorphism design with orbital floating photos around center logo,
dark mode interface with deep purple-black background,
vibrant coral pink neon logo with glow effect (#FF6B6B),
floating profile photos in orbit animation style,
premium AI photo app aesthetic, iOS style,
high-quality 4K render, Figma/Sketch export quality,
text "PinGlass" as glowing neon logo in center`,

  dashboard: `Professional mobile app UI mockup, dashboard screen with avatar grid,
modern minimal design, dark mode with glassmorphism cards,
2x3 grid of AI-generated portrait thumbnails with rounded corners,
coral pink accent color (#FF6B6B), purple secondary (#9B59B6),
bottom pricing tier cards showing "7 photos", "15 photos", "23 photos",
premium photo generation app aesthetic,
high-quality 4K render, clean typography`,

  payment: `Professional mobile app UI mockup, payment modal bottom sheet,
dark glassmorphism modal with blur background,
three tier selection cards (Starter 499₽, Standard 999₽, Premium 1499₽),
payment method buttons (Bank Card, Telegram Stars, TON crypto),
coral pink gradient primary button,
modern fintech payment UX, iOS style,
4K quality, Figma-style mockup`,

  tierSelect: `Professional mobile app UI mockup, pricing tier selection screen,
three vertical cards with glassmorphism effect,
"7 photos - 499₽", "15 photos - 999₽ POPULAR", "23 photos - 1499₽",
coral pink selection indicator and badges,
dark mode with subtle gradients,
premium subscription UI pattern,
high-quality render, clean minimalist design`,

  generating: `Professional mobile app UI mockup, AI generation progress screen,
dark mode with animated progress indicator,
circular progress ring with percentage (67%),
glowing coral pink accent (#FF6B6B),
status text "Generating your photos...",
subtle particle effects in background,
premium loading state design, iOS style`,

  results: `Professional mobile app UI mockup, photo gallery results screen,
masonry grid of AI-generated portrait photos,
dark mode interface, coral pink download buttons,
share and download action buttons,
"Generate More" CTA button at bottom,
premium photo app gallery UX,
4K quality mockup, Figma style`,

  adminDashboard: `Professional web admin dashboard UI mockup,
light mode with clean white background,
KPI cards showing Users, Revenue, Generations metrics,
line chart for daily revenue trend,
data table with user list below,
coral pink accent color for highlights,
enterprise SaaS admin panel aesthetic,
responsive desktop layout, high-quality render`,

  adminPayments: `Professional web admin panel UI mockup, payments management screen,
data table with columns: ID, User, Amount, Status, Provider, Date,
filter bar with status and date range selectors,
status badges (succeeded=green, pending=yellow, failed=red),
refund action buttons, export functionality,
clean business dashboard aesthetic, light mode`,
};

async function createGenerationTask(prompt: string, aspectRatio: string = '9:16'): Promise<string> {
  const response = await fetch(`${KIE_BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'nano-banana-pro',
      prompt: prompt,
      aspect_ratio: aspectRatio,
      resolution: '4K',
      output_format: 'png',
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.task_id;
}

async function pollTaskStatus(taskId: string): Promise<GenerationTask> {
  const response = await fetch(`${KIE_BASE_URL}/jobs/recordInfo?task_id=${taskId}`, {
    headers: {
      'Authorization': `Bearer ${KIE_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function generateMockup(type: keyof typeof PROMPT_TEMPLATES, outputPath: string) {
  const prompt = PROMPT_TEMPLATES[type];
  const aspectRatio = type.startsWith('admin') ? '16:9' : '9:16';

  console.log(`🎨 Generating ${type} mockup...`);
  console.log(`📝 Prompt: ${prompt.slice(0, 100)}...`);

  try {
    const taskId = await createGenerationTask(prompt, aspectRatio);
    console.log(`✅ Task created: ${taskId}`);

    // Poll for completion
    let attempts = 0;
    while (attempts < 60) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const status = await pollTaskStatus(taskId);

      if (status.status === 'completed' && status.result?.images) {
        console.log(`🖼️ Generation complete! Images: ${status.result.images.length}`);
        // Download and save images
        for (let i = 0; i < status.result.images.length; i++) {
          const imageUrl = status.result.images[i];
          const filename = `${outputPath}/${type}-${i + 1}.png`;
          console.log(`💾 Saved: ${filename}`);
        }
        return status.result.images;
      } else if (status.status === 'failed') {
        throw new Error('Generation failed');
      }

      console.log(`⏳ Status: ${status.status} (attempt ${++attempts}/60)`);
    }

    throw new Error('Timeout waiting for generation');
  } catch (error) {
    console.error(`❌ Error: ${error}`);
    throw error;
  }
}

// CLI interface
const args = process.argv.slice(2);
const mockupType = args[0] as keyof typeof PROMPT_TEMPLATES || 'onboarding';
const outputDir = args[1] || './NewDesign/web/mockups';

console.log(`
╔══════════════════════════════════════════╗
║   PinGlass Design Mockup Generator       ║
╠══════════════════════════════════════════╣
║ Type: ${mockupType.padEnd(33)}║
║ Output: ${outputDir.padEnd(31)}║
╚══════════════════════════════════════════╝
`);

if (!KIE_API_KEY) {
  console.error('❌ KIE_AI_API_KEY environment variable not set');
  process.exit(1);
}

generateMockup(mockupType, outputDir)
  .then(() => console.log('✅ Done!'))
  .catch(() => process.exit(1));
