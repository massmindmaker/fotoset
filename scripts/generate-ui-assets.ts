/**
 * Скрипт генерации UI-ассетов через Kie.ai (Nano Banana Pro)
 *
 * Генерирует:
 * 1. Фоновые изображения для hero-секции
 * 2. Иллюстрации для onboarding
 * 3. Декоративные элементы
 */

const KIE_API_URL = "https://api.kie.ai/api/v1/jobs/createTask"
const KIE_STATUS_URL = "https://api.kie.ai/api/v1/jobs/recordInfo"

interface UIAsset {
  name: string
  prompt: string
  aspectRatio: "1:1" | "16:9" | "9:16" | "3:4" | "4:3"
  description: string
}

// Промпты для UI-элементов в стиле PinGlass + DreamPack
const UI_ASSETS: UIAsset[] = [
  // === ORBIT PORTRAITS - DreamPack Style + Pink Glasses ===
  {
    name: "orbit-pink-lion",
    prompt: "Dramatic studio portrait of confident person wearing stylish pink tinted sunglasses, standing with a majestic lion. Person in elegant dark clothing with distinctive rose-colored aviator glasses. Deep black background, professional lighting. Lion's mane full and luxurious. Power and courage composition. Medium format camera, fine art portrait, 8K",
    aspectRatio: "1:1",
    description: "DreamPack: Со львом + розовые очки"
  },
  {
    name: "orbit-pink-motorcycle",
    prompt: "Cinematic photo of stylish person wearing rose pink tinted sunglasses on cafe racer motorcycle at sunset. Leather jacket, confident pose looking at camera through pink aviator glasses. BMW R nineT cafe racer in golden hour light. Mountain road backdrop. Hasselblad quality, film-like rich colors",
    aspectRatio: "1:1",
    description: "DreamPack: Мотогонщик + розовые очки"
  },
  {
    name: "orbit-pink-yacht",
    prompt: "Action sailing photo of person at helm of racing yacht wearing distinctive pink tinted sunglasses. High-end sailing gear, focused expression behind rose-colored glasses. Yacht heeled dramatically, spray flying. Deep blue Mediterranean waters. Professional sailing photography, high shutter speed",
    aspectRatio: "1:1",
    description: "DreamPack: Регата + розовые очки"
  },
  {
    name: "orbit-pink-jet",
    prompt: "Luxurious photo of elegant person wearing pink tinted aviator sunglasses seated in private jet cabin with champagne. Smart business attire, relaxed sophisticated pose. Rose-colored glasses catching cabin light. Gulfstream interior, cream leather seats. Professional lifestyle photography, warm lighting",
    aspectRatio: "1:1",
    description: "DreamPack: На борту джета + розовые очки"
  },
  // === MORE ORBIT PORTRAITS - DreamPack + Pink Glasses ===
  {
    name: "orbit-pink-rockstar",
    prompt: "Epic concert photo of rock star wearing pink tinted sunglasses on stage with electric guitar. Leather jacket with studs, dramatic red and purple stage lighting, smoke effects. Rose-colored glasses reflecting spotlights. Gibson Les Paul guitar, passionate playing pose. Professional concert photography, high ISO atmosphere",
    aspectRatio: "1:1",
    description: "DreamPack: Рокер + розовые очки"
  },
  {
    name: "orbit-pink-chef",
    prompt: "Dynamic photo of professional chef wearing pink tinted sunglasses performing flambe in upscale kitchen. White chef coat, traditional toque, dramatic flames rising from pan illuminating face. Rose-colored glasses reflecting warm orange glow. Stainless steel kitchen environment. Culinary arts photography",
    aspectRatio: "1:1",
    description: "DreamPack: Повар + розовые очки"
  },
  {
    name: "orbit-pink-skydive",
    prompt: "Incredible freefall photo of person wearing pink tinted goggles skydiving over Dubai with Palm Jumeirah visible below. Professional jumpsuit, expression of exhilaration. Rose-tinted goggles, Dubai skyline with Burj Al Arab visible from altitude. Crystal clear day, extreme sports photography",
    aspectRatio: "1:1",
    description: "DreamPack: Прыжок в Дубае + розовые очки"
  },
  {
    name: "orbit-pink-surfer",
    prompt: "Legendary surf photo of person wearing pink tinted sunglasses riding inside perfect barrel wave. Shortboard in tube position, hand touching wave face. Rose-colored sport glasses, crystal turquoise water curling overhead, light refracting through wave. Tropical location, water photographer position",
    aspectRatio: "1:1",
    description: "DreamPack: Сёрфер + розовые очки"
  },
  // === MAIN CENTER PORTRAIT - Hero with Pink Glasses ===
  {
    name: "main-pink-hero",
    prompt: "Breathtaking portrait of confident person wearing iconic pink tinted sunglasses beside majestic male lion in African savanna. Safari khaki clothing, calm expression looking at camera through rose-colored aviator glasses. Golden hour African light, acacia trees silhouetted. Lion with magnificent mane. Phase One IQ4 quality, National Geographic style",
    aspectRatio: "3:4",
    description: "DreamPack Hero: Со львом + розовые очки"
  },
  // === ORIGINAL ASSETS ===
  {
    name: "hero-background-pink",
    prompt: "Abstract flowing gradient background, soft pink and purple tones, gentle waves of light, dreamy bokeh lights, minimal modern style, high quality, 4K resolution, no text, no objects, pure abstract art",
    aspectRatio: "9:16",
    description: "Фон для hero-секции (мобильный)"
  },
  {
    name: "hero-background-desktop",
    prompt: "Wide abstract gradient wallpaper, pink magenta purple color palette, soft flowing shapes, glassmorphism style, ethereal light rays, modern minimal aesthetic, cinematic quality, no text",
    aspectRatio: "16:9",
    description: "Фон для hero-секции (десктоп)"
  },
  {
    name: "onboarding-upload",
    prompt: "Flat illustration of smartphone with photos floating around it, pastel pink and white colors, friendly modern style, simple geometric shapes, clean white background, vector art style",
    aspectRatio: "1:1",
    description: "Иллюстрация: загрузка фото"
  },
  {
    name: "onboarding-ai-magic",
    prompt: "Flat illustration of magical sparkles transforming a simple photo into professional portrait, pink and gold colors, modern friendly style, white background, vector art, magical transformation effect",
    aspectRatio: "1:1",
    description: "Иллюстрация: AI-магия"
  },
  {
    name: "onboarding-results",
    prompt: "Flat illustration of photo gallery grid with professional portraits, happy person looking at results on phone, pastel pink purple colors, modern vector style, white background, celebration confetti",
    aspectRatio: "1:1",
    description: "Иллюстрация: результаты"
  },
  {
    name: "empty-state-avatar",
    prompt: "Minimal illustration of empty photo frame with plus sign, soft pink glow effect, modern UI style, simple geometric, white background, inviting friendly design",
    aspectRatio: "3:4",
    description: "Empty state для аватара"
  },
  {
    name: "style-preview-professional",
    prompt: "Professional business portrait style preview, confident person in office setting, clean corporate background, professional lighting, LinkedIn profile photo style, high quality",
    aspectRatio: "3:4",
    description: "Превью стиля Professional"
  },
  {
    name: "style-preview-lifestyle",
    prompt: "Lifestyle social media portrait, person in cozy cafe setting, natural warm lighting, instagram aesthetic, friendly smile, casual elegant style, bokeh background",
    aspectRatio: "3:4",
    description: "Превью стиля Lifestyle"
  },
  {
    name: "style-preview-creative",
    prompt: "Creative artistic portrait, dramatic studio lighting, colorful neon accents pink and purple, editorial magazine style, bold artistic expression, high fashion aesthetic",
    aspectRatio: "3:4",
    description: "Превью стиля Creative"
  }
]

async function createKieTask(prompt: string, aspectRatio: string): Promise<string | null> {
  const apiKey = process.env.KIE_AI_API_KEY || process.env.KIE_API_KEY

  if (!apiKey) {
    console.error("KIE_API_KEY not found in environment")
    return null
  }

  try {
    // Use same format as lib/kie.ts
    const input = {
      prompt,
      output_format: "png",
      image_size: aspectRatio,
    }

    const response = await fetch(KIE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nano-banana-pro",
        input,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`API error: ${response.status} - ${errorText.substring(0, 200)}`)
      return null
    }

    const data = await response.json()
    const taskId = data.data?.taskId || data.taskId
    if (!taskId) {
      console.error(`No taskId: ${JSON.stringify(data).substring(0, 200)}`)
    }
    return taskId || null
  } catch (error) {
    console.error("Error creating task:", error)
    return null
  }
}

async function checkTaskStatus(taskId: string): Promise<{ status: string; imageUrl?: string }> {
  const apiKey = process.env.KIE_AI_API_KEY || process.env.KIE_API_KEY

  try {
    // Use same format as lib/kie.ts
    const response = await fetch(`${KIE_STATUS_URL}?taskId=${taskId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      return { status: "pending" }
    }

    const data = await response.json()
    const status = data.data?.state || data.data?.status || data.status

    // Handle completed status
    if (status === "success" || status === "SUCCESS" || status === "COMPLETED") {
      let imageUrl = ""

      // Parse resultJson if it's a string
      if (data.data?.resultJson) {
        try {
          const resultJson = typeof data.data.resultJson === "string"
            ? JSON.parse(data.data.resultJson)
            : data.data.resultJson
          imageUrl = resultJson.resultUrls?.[0] || resultJson.url || ""
        } catch {}
      }

      if (!imageUrl) {
        imageUrl = data.data?.output?.url ||
                   data.data?.output?.[0]?.url ||
                   data.data?.url ||
                   data.output?.url || ""
      }

      return { status: "completed", imageUrl }
    }

    if (status === "FAILED" || status === "failed") {
      return { status: "failed" }
    }

    return { status: "pending" }
  } catch {
    return { status: "error" }
  }
}

async function waitForResult(taskId: string, maxAttempts = 60): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await checkTaskStatus(taskId)

    if (result.status === "completed" && result.imageUrl) {
      return result.imageUrl
    }

    if (result.status === "failed" || result.status === "error") {
      console.error(`Task ${taskId} failed`)
      return null
    }

    // Wait 2 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 2000))
    process.stdout.write(".")
  }

  console.error(`Task ${taskId} timed out`)
  return null
}

async function generateAsset(asset: UIAsset): Promise<{ name: string; url: string | null }> {
  console.log(`\n[${asset.name}] Starting generation...`)
  console.log(`  Description: ${asset.description}`)
  console.log(`  Aspect ratio: ${asset.aspectRatio}`)

  const taskId = await createKieTask(asset.prompt, asset.aspectRatio)

  if (!taskId) {
    console.error(`  Failed to create task`)
    return { name: asset.name, url: null }
  }

  console.log(`  Task ID: ${taskId}`)
  process.stdout.write("  Waiting")

  const imageUrl = await waitForResult(taskId)

  if (imageUrl) {
    console.log(`\n  SUCCESS: ${imageUrl}`)
  } else {
    console.log(`\n  FAILED`)
  }

  return { name: asset.name, url: imageUrl }
}

async function main() {
  console.log("=".repeat(60))
  console.log("  PinGlass UI Assets Generator (Kie.ai Nano Banana Pro)")
  console.log("=".repeat(60))

  // Check API key
  const apiKey = process.env.KIE_AI_API_KEY || process.env.KIE_API_KEY
  if (!apiKey) {
    console.error("\nERROR: Set KIE_AI_API_KEY or KIE_API_KEY environment variable")
    process.exit(1)
  }
  console.log("\nAPI Key: " + apiKey.substring(0, 10) + "...")

  // Generate only specified assets or all
  const targetAsset = process.argv[2]
  const assetsToGenerate = targetAsset
    ? UI_ASSETS.filter(a => a.name === targetAsset)
    : UI_ASSETS.slice(0, 3) // Default: only first 3 for demo

  if (assetsToGenerate.length === 0) {
    console.error(`\nAsset "${targetAsset}" not found. Available:`)
    UI_ASSETS.forEach(a => console.log(`  - ${a.name}: ${a.description}`))
    process.exit(1)
  }

  console.log(`\nGenerating ${assetsToGenerate.length} assets:`)
  assetsToGenerate.forEach(a => console.log(`  - ${a.name}`))

  const results: { name: string; url: string | null }[] = []

  for (const asset of assetsToGenerate) {
    const result = await generateAsset(asset)
    results.push(result)
  }

  // Summary
  console.log("\n" + "=".repeat(60))
  console.log("  RESULTS SUMMARY")
  console.log("=".repeat(60))

  const successful = results.filter(r => r.url)
  const failed = results.filter(r => !r.url)

  console.log(`\nSuccessful: ${successful.length}/${results.length}`)

  if (successful.length > 0) {
    console.log("\nGenerated images:")
    successful.forEach(r => {
      console.log(`\n  ${r.name}:`)
      console.log(`  ${r.url}`)
    })
  }

  if (failed.length > 0) {
    console.log("\nFailed:")
    failed.forEach(r => console.log(`  - ${r.name}`))
  }

  // Generate HTML preview
  if (successful.length > 0) {
    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PinGlass - AI Generated UI Assets</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, sans-serif;
      background: #0a0a0a;
      color: white;
      padding: 40px 20px;
    }
    h1 {
      text-align: center;
      margin-bottom: 40px;
      color: #FF6B6B;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .card {
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .card img {
      width: 100%;
      height: 300px;
      object-fit: cover;
    }
    .card-info {
      padding: 16px;
    }
    .card-info h3 {
      font-size: 16px;
      margin-bottom: 8px;
    }
    .card-info p {
      font-size: 14px;
      color: rgba(255,255,255,0.6);
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      background: linear-gradient(135deg, #FF6B6B, #a855f7);
      border-radius: 8px;
      font-size: 10px;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <h1>AI-Generated UI Assets (Kie.ai)</h1>
  <div class="grid">
    ${successful.map(r => {
      const asset = UI_ASSETS.find(a => a.name === r.name)
      return `
    <div class="card">
      <img src="${r.url}" alt="${r.name}" />
      <div class="card-info">
        <span class="badge">Nano Banana Pro</span>
        <h3>${r.name}</h3>
        <p>${asset?.description || ''}</p>
      </div>
    </div>`
    }).join('')}
  </div>
</body>
</html>`

    const fs = await import('fs')
    const previewPath = './docs/redesign-preview/kie-generated-assets.html'
    fs.writeFileSync(previewPath, html)
    console.log(`\nPreview saved to: ${previewPath}`)
  }
}

main().catch(console.error)
