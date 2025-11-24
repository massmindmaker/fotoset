// 23 уникальных промпта для генерации фотосета

export const PHOTOSET_PROMPTS = [
  // 1. Горные вершины - оранжевая куртка
  `A candid iPhone-style photo capturing a figure standing confidently against jagged, snow-covered peaks under a clear alpine sky. Wearing a bright orange down jacket with a clean, minimal design, its glossy nylon surface puffed and subtly weathered by the elements. Loose olive-green technical trousers feature dangling drawcords, combining warmth with practical style. Standing with arms folded firmly across chest in a relaxed yet self-protective pose, blending quiet resilience with a calm, neutral facial angle partially obscured by sunglasses. Natural daylight casts soft, crisp illumination across textured snow, fractured rock, and reflective fabric surfaces.`,

  // 2. Лодка на море - синяя рубашка
  `A candid iPhone-style photo capturing a relaxed medium full-body shot, seated angle from side, subject lounging on boat seat. ISO 200, f/4.0, 1/500s. Adult figure with laid-back expression wearing open blue linen shirt, white drawstring shorts, silver chain necklace, bracelet, earrings, sunglasses. Onboard a boat with scenic coastal town and terraced green hills in background. Late afternoon with warm sunlight. Calm sea with anchored yachts and sailboats, coastal architecture visible along hillside. Reclining on cushioned boat seat, arm casually stretched over seat. Natural golden-hour sunlight, warm glow on subject.`,

  // 3. Кафе террасса
  `A candid lifestyle photo of a person sitting at a charming European cafe terrace, morning light streaming through. Wearing a crisp white linen shirt and light beige chinos. A small espresso cup on the marble table. Cobblestone street visible in background with passersby. Relaxed posture, one arm resting on chair back, genuine smile. Soft morning shadows, warm Mediterranean atmosphere.`,

  // 4. Городская улица
  `Street style photography of a figure walking confidently down a modern city street. Wearing tailored navy blazer over white t-shirt, dark jeans, clean white sneakers. Glass buildings reflecting afternoon sun. Motion blur on background pedestrians. Subject sharp and in focus. Urban sophisticated vibe, natural daylight.`,

  // 5. Парк на закате
  `Golden hour portrait in a lush green park, subject sitting on wooden bench. Warm sunlight filtering through tree leaves creating dappled lighting. Casual outfit - cream knit sweater, dark fitted pants. Peaceful expression, looking slightly off-camera. Soft bokeh background of trees and grass.`,

  // 6. Пляж на рассвете
  `Dawn beach portrait, soft pink and orange sky reflecting on calm water. Subject standing at water's edge, barefoot in sand. Wearing loose white linen pants and light gray hoodie. Wind gently moving hair and clothes. Contemplative mood, looking toward horizon. Minimalist composition.`,

  // 7. Библиотека/книжный
  `Warm indoor portrait in a cozy bookstore or library. Tall wooden shelves filled with books in background. Subject sitting in leather armchair, holding an open book. Wearing round glasses, dark green cardigan over white shirt. Soft warm lighting from vintage lamps. Intellectual, comfortable atmosphere.`,

  // 8. Крыша с видом на город
  `Rooftop portrait at blue hour, city skyline glittering in background. Subject leaning casually against railing. Wearing black leather jacket, dark jeans. City lights creating bokeh. Cool blue ambient light mixed with warm artificial lights. Urban nightlife mood.`,

  // 9. Винтажный автомобиль
  `Lifestyle shot next to a classic vintage car, cream or pastel colored. Subject leaning against the car door. Wearing high-waisted jeans, tucked-in striped shirt, loafers. Sunny day, suburban street with trees. Retro Americana aesthetic, nostalgic mood.`,

  // 10. Художественная студия
  `Creative portrait in an artist's studio. Canvas and paint supplies visible. Subject in paint-splattered denim overalls over black turtleneck. Natural light from large windows. Thoughtful expression, perhaps holding a brush. Raw, authentic creative atmosphere.`,

  // 11. Осенний лес
  `Autumn forest portrait, surrounded by trees with orange and red foliage. Subject walking on leaf-covered path. Wearing cozy brown wool coat, knit scarf. Soft diffused light through branches. Warm earth tones, peaceful fall mood.`,

  // 12. Современный офис
  `Professional portrait in sleek modern office space. Floor-to-ceiling windows, minimalist furniture. Subject in well-fitted charcoal suit, no tie, top button undone. Standing by window, city view behind. Clean lines, success and ambition aesthetic.`,

  // 13. Фермерский рынок
  `Candid shot at a colorful farmers market. Subject examining fresh produce at a stall. Wearing casual sundress or light summer outfit, woven tote bag. Vibrant fruits and vegetables creating colorful background. Natural daylight, authentic lifestyle moment.`,

  // 14. Мост в тумане
  `Atmospheric portrait on an old bridge in morning fog. Mysterious moody lighting. Subject in long dark coat, hands in pockets. Bridge railings disappearing into mist. Cinematic, contemplative mood. Muted color palette.`,

  // 15. Спортивная площадка
  `Athletic lifestyle shot on outdoor basketball court or running track. Subject in sporty athleisure - fitted tank, joggers, clean trainers. Dynamic pose, perhaps mid-stretch. Golden hour lighting. Healthy active lifestyle aesthetic.`,

  // 16. Уютная кухня
  `Warm domestic scene in a bright, modern kitchen. Subject preparing food or holding coffee mug. Wearing comfortable home clothes - soft sweater, relaxed pants. Morning light through window. Hygge cozy atmosphere, natural and approachable.`,

  // 17. Музыкальная студия
  `Portrait in a music studio or with musical instruments. Headphones around neck, vintage microphone or guitar visible. Wearing casual band t-shirt, jeans. Moody lighting with some colored accent lights. Creative musician vibe.`,

  // 18. Японский сад
  `Serene portrait in a traditional Japanese garden. Stone lanterns, manicured bushes, perhaps a small bridge or pond. Subject in minimalist outfit - black and white or earth tones. Zen peaceful atmosphere, balanced composition.`,

  // 19. Ресторан высокой кухни
  `Elegant portrait at upscale restaurant table. Soft candlelight, wine glasses on white tablecloth. Subject in sophisticated evening wear - perhaps silk blouse or refined suit. Intimate atmosphere, subtle luxury.`,

  // 20. Горный поход
  `Adventure hiking photo on mountain trail. Panoramic vista in background. Subject with small backpack, wearing technical outdoor gear - fleece, hiking boots. Standing on rocky outcrop. Achievement and freedom feeling.`,

  // 21. Дождливый город
  `Moody rainy day street portrait. Subject under transparent umbrella, wet pavement reflecting city lights. Wearing trench coat. Cinematic noir feeling, blue-gray color palette with warm light accents from shop windows.`,

  // 22. Винный погреб
  `Atmospheric portrait in a wine cellar. Rows of aged wine bottles on wooden racks. Warm candlelight or dim bulbs. Subject holding wine glass, wearing smart casual - perhaps cashmere and dark pants. Sophisticated, mature aesthetic.`,

  // 23. Яхт-клуб
  `Nautical lifestyle shot at marina or yacht club. White sailboats in background. Subject in classic preppy outfit - striped shirt, white pants, boat shoes. Bright sunny day, blue sky and water. Aspirational coastal luxury vibe.`,
]

export const STYLE_CONFIGS = {
  professional: {
    name: "Профессиональный",
    description: "Деловые портреты для LinkedIn и резюме",
    promptPrefix: "Professional business portrait, ",
    promptSuffix: " Corporate clean background, confident posture, professional attire.",
    selectedPrompts: [3, 4, 11, 6, 18, 21, 0, 19, 7], // индексы из PHOTOSET_PROMPTS
  },
  lifestyle: {
    name: "Lifestyle",
    description: "Естественные фото для социальных сетей",
    promptPrefix: "Candid lifestyle photography, ",
    promptSuffix: " Natural authentic moment, warm lighting.",
    selectedPrompts: [1, 2, 4, 5, 8, 12, 15, 16, 22], // индексы из PHOTOSET_PROMPTS
  },
  creative: {
    name: "Креативный",
    description: "Художественные портреты для творческих проектов",
    promptPrefix: "Artistic creative portrait, ",
    promptSuffix: " Unique composition, dramatic lighting, artistic expression.",
    selectedPrompts: [9, 13, 16, 17, 10, 20, 14, 7, 6], // индексы из PHOTOSET_PROMPTS
  },
}
