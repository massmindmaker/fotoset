// Утилиты для обработки и валидации изображений
// Включает face detection и smart prompt merging

/**
 * Результат валидации изображения
 */
export interface ImageValidationResult {
  isValid: boolean
  hasFace: boolean
  quality: "high" | "medium" | "low"
  issues: string[]
  metadata?: {
    width: number
    height: number
    aspectRatio: number
    sizeKb: number
  }
}

/**
 * Конфигурация промпта с учётом конфликтов
 */
export interface PromptMergeConfig {
  basePrompt: string
  stylePrefix: string
  styleSuffix: string
  // Ключевые слова для замены при конфликте
  conflictKeywords?: {
    base: string[]  // слова из базового промпта
    style: string[] // слова из стиля которые конфликтуют
  }[]
}

// Локации/сцены которые конфликтуют с "corporate background"
const OUTDOOR_SCENE_KEYWORDS = [
  "beach", "mountain", "forest", "park", "street", "cafe", "terrace",
  "boat", "yacht", "marina", "garden", "market", "bridge", "hiking",
  "rooftop", "outdoor", "nature", "sea", "ocean", "lake", "river",
]

// Одежда которая конфликтует с "professional attire"
const CASUAL_CLOTHING_KEYWORDS = [
  "hoodie", "shorts", "barefoot", "swimwear", "tank top", "joggers",
  "sundress", "flip flops", "athletic", "sporty", "overalls",
]

// Настроение которое конфликтует с "corporate/professional"
const CASUAL_MOOD_KEYWORDS = [
  "relaxed", "lounging", "barefoot", "casual", "laid-back",
  "adventur", "playful", "cozy", "intimate",
]

/**
 * Базовая валидация изображения (размер, формат)
 * Для полной face detection нужен отдельный ML сервис
 */
export function validateImage(base64Image: string): ImageValidationResult {
  const issues: string[] = []

  // Проверяем размер (base64 примерно на 33% больше оригинала)
  const sizeBytes = base64Image.length * 0.75
  const sizeKb = Math.round(sizeBytes / 1024)

  if (sizeKb < 10) {
    issues.push("Image too small (< 10KB)")
  }
  if (sizeKb > 10240) {
    issues.push("Image too large (> 10MB)")
  }

  // Определяем качество по размеру
  let quality: "high" | "medium" | "low" = "medium"
  if (sizeKb > 500) quality = "high"
  else if (sizeKb < 50) quality = "low"

  // Базовая проверка формата
  const isValidFormat =
    base64Image.startsWith("data:image/jpeg") ||
    base64Image.startsWith("data:image/png") ||
    base64Image.startsWith("data:image/webp") ||
    base64Image.startsWith("/9j/") || // JPEG magic bytes
    base64Image.startsWith("iVBOR") // PNG magic bytes

  if (!isValidFormat) {
    issues.push("Invalid image format")
  }

  return {
    isValid: issues.length === 0,
    hasFace: true, // Предполагаем что есть лицо (нужен ML для точной проверки)
    quality,
    issues,
    metadata: {
      width: 0, // Требуется декодирование для точных размеров
      height: 0,
      aspectRatio: 1,
      sizeKb,
    },
  }
}

/**
 * Фильтрация и сортировка референсных изображений по качеству
 */
export function filterAndSortReferenceImages(
  images: string[],
  maxImages = 4
): {
  selected: string[]
  rejected: Array<{ index: number; reason: string }>
} {
  const validationResults = images.map((img, index) => ({
    index,
    image: img,
    validation: validateImage(img),
  }))

  // Фильтруем невалидные
  const rejected = validationResults
    .filter(r => !r.validation.isValid)
    .map(r => ({
      index: r.index,
      reason: r.validation.issues.join(", "),
    }))

  // Сортируем по качеству
  const valid = validationResults
    .filter(r => r.validation.isValid)
    .sort((a, b) => {
      const qualityOrder = { high: 0, medium: 1, low: 2 }
      return qualityOrder[a.validation.quality] - qualityOrder[b.validation.quality]
    })

  return {
    selected: valid.slice(0, maxImages).map(r => r.image),
    rejected,
  }
}

/**
 * Умное слияние промптов с разрешением конфликтов
 * Решает проблему: "cafe terrace" + "corporate clean background"
 */
export function smartMergePrompt(config: PromptMergeConfig): string {
  const { basePrompt, stylePrefix, styleSuffix } = config

  // Определяем тип стиля
  const isProfessionalStyle =
    styleSuffix.toLowerCase().includes("corporate") ||
    styleSuffix.toLowerCase().includes("professional") ||
    styleSuffix.toLowerCase().includes("business")

  const isLifestyleStyle =
    stylePrefix.toLowerCase().includes("candid") ||
    stylePrefix.toLowerCase().includes("lifestyle")

  const isCreativeStyle =
    stylePrefix.toLowerCase().includes("artistic") ||
    stylePrefix.toLowerCase().includes("creative")

  // Для профессионального стиля модифицируем промпт
  if (isProfessionalStyle) {
    let modifiedPrompt = basePrompt

    // Проверяем на outdoor сцены
    const hasOutdoorScene = OUTDOOR_SCENE_KEYWORDS.some(keyword =>
      basePrompt.toLowerCase().includes(keyword)
    )

    if (hasOutdoorScene) {
      // Заменяем outdoor локации на нейтральные indoor
      // Вместо полной замены, добавляем контекст студийной съёмки
      modifiedPrompt = modifiedPrompt
        .replace(/at a charming European cafe terrace/gi, "in a modern studio setting")
        .replace(/at outdoor basketball court/gi, "in a professional photography studio")
        .replace(/on mountain trail/gi, "in front of a subtle gradient background")
        .replace(/at marina or yacht club/gi, "in an elegant office environment")
        .replace(/standing at water's edge/gi, "standing in a studio")
        .replace(/Onboard a boat/gi, "In a professional setting")

      // Если не удалось заменить конкретную фразу, добавляем студийный контекст
      if (modifiedPrompt === basePrompt) {
        // Добавляем студийный контекст в начало
        modifiedPrompt = `Professional studio portrait inspired by: ${basePrompt}`
      }
    }

    // Заменяем casual одежду
    const hasCasualClothing = CASUAL_CLOTHING_KEYWORDS.some(keyword =>
      basePrompt.toLowerCase().includes(keyword)
    )

    if (hasCasualClothing) {
      modifiedPrompt = modifiedPrompt
        .replace(/hoodie/gi, "blazer")
        .replace(/shorts/gi, "tailored trousers")
        .replace(/barefoot/gi, "in elegant shoes")
        .replace(/sundress/gi, "professional dress")
        .replace(/joggers/gi, "dress pants")
        .replace(/tank top/gi, "crisp shirt")
    }

    return `${stylePrefix}${modifiedPrompt}${styleSuffix}`
  }

  // Для lifestyle стиля - минимальные изменения, только смягчаем конфликты
  if (isLifestyleStyle) {
    // Убираем formal элементы если есть
    let modifiedSuffix = styleSuffix
      .replace(/Corporate clean background,/gi, "")
      .replace(/professional attire/gi, "comfortable stylish outfit")

    return `${stylePrefix}${basePrompt}${modifiedSuffix}`
  }

  // Для creative стиля - подчёркиваем художественность
  if (isCreativeStyle) {
    // Добавляем художественные элементы
    const enhancedPrompt = basePrompt.replace(
      /Natural daylight/gi,
      "Dramatic creative lighting"
    ).replace(
      /Soft morning shadows/gi,
      "Bold artistic shadows"
    )

    return `${stylePrefix}${enhancedPrompt}${styleSuffix}`
  }

  // Default: простое соединение
  return `${stylePrefix}${basePrompt}${styleSuffix}`
}

/**
 * Генерация улучшенного промпта с дополнительными деталями для консистентности
 */
export function enhancePromptForConsistency(
  prompt: string,
  subjectDescription?: string
): string {
  // Базовые улучшения для консистентности лица
  const consistencyEnhancements = [
    "maintaining consistent facial features",
    "same person throughout",
    "consistent skin tone and complexion",
    "recognizable face structure",
  ]

  // Если есть описание субъекта, добавляем его
  if (subjectDescription) {
    return `${prompt}\n\nSubject: ${subjectDescription}. ${consistencyEnhancements.join(", ")}.`
  }

  // Добавляем только консистентность
  return `${prompt}\n\n${consistencyEnhancements.join(", ")}.`
}

/**
 * Определение оптимального количества референсных изображений
 * на основе их качества и разнообразия
 */
export function calculateOptimalReferenceCount(
  images: string[],
  targetCount = 4
): number {
  if (images.length === 0) return 0
  if (images.length <= targetCount) return images.length

  // Анализируем качество
  const validations = images.map(img => validateImage(img))
  const highQualityCount = validations.filter(v => v.quality === "high").length

  // Если много качественных - берём больше для лучшей консистентности
  if (highQualityCount >= 3) return Math.min(4, images.length)

  // Если качество среднее - берём меньше, чтобы избежать путаницы
  if (highQualityCount === 0) return Math.min(2, images.length)

  return Math.min(3, images.length)
}
