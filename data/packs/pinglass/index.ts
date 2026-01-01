/**
 * PINGLASS PACK - Оригинальная коллекция 23 журнальных промптов
 * Premium Magazine Quality (Vogue/GQ/Elle)
 * Created: 2026-01-01
 */

export interface PinGlassPrompt {
  id: string
  nameRU: string
  nameEN: string
  prompt: string
  negativePrompt?: string
  category: 'outdoor' | 'lifestyle' | 'professional' | 'creative' | 'travel' | 'luxury'
  tags: string[]
}

// 1. Alpine Adventure - Горные вершины
export const alpineAdventure: PinGlassPrompt = {
  id: 'alpine-adventure',
  nameRU: 'Горные вершины',
  nameEN: 'Alpine Adventure',
  category: 'outdoor',
  tags: ['mountains', 'adventure', 'nature', 'orange jacket', 'winter'],
  prompt: `Shot on Hasselblad X2D 100C with 90mm f/2.5 lens. National Geographic adventure editorial.

SUBJECT: Confident figure standing against dramatic jagged snow-covered alpine peaks under crystal-clear sky. Wearing premium bright orange Moncler down jacket with glossy nylon finish, subtle weather-worn texture. Olive-green Arc'teryx technical trousers with functional drawcords. Arms folded firmly across chest in powerful yet relaxed stance. Aviator sunglasses, calm neutral expression.

LIGHTING: Natural high-altitude daylight, crisp and pure. Soft shadows on snow, rim light from sun creating separation. Golden hour mountain light quality.

TECHNICAL: Medium format sensor depth, tack-sharp focus on subject, f/2.5 bokeh on distant peaks. Visible fabric texture, snow crystal details. ISO 100 clarity.

POST: Cool-warm color balance, subtle contrast enhancement, magazine-grade sharpening. Patagonia campaign aesthetic.`,
  negativePrompt: 'blur, low quality, indoor, artificial lighting'
}

// 2. Coastal Luxury - Лодка на море
export const coastalLuxury: PinGlassPrompt = {
  id: 'coastal-luxury',
  nameRU: 'Лодка на море',
  nameEN: 'Coastal Luxury',
  category: 'travel',
  tags: ['yacht', 'mediterranean', 'ocean', 'luxury', 'summer'],
  prompt: `Shot on Sony α7R V with Sony FE 85mm f/1.4 GM lens. Condé Nast Traveller editorial.

SUBJECT: Relaxed figure lounging on luxury yacht cushioned seat, Mediterranean golden hour. Open blue linen Loro Piana shirt, white linen drawstring shorts. Silver chain necklace, leather bracelet, Ray-Ban Aviators. Laid-back confident expression, arm casually stretched over seat back.

SETTING: Sleek yacht deck, scenic Italian coastal town (Positano aesthetic) with terraced green hills in background. Calm turquoise sea, anchored superyachts visible. Late afternoon warm sunlight.

LIGHTING: Natural golden-hour glow, warm tones on skin and fabric. Soft shadows, no harsh contrasts. Reflections on water creating bokeh.

TECHNICAL: f/1.4 shallow depth, boat interior sharp, coastline softly blurred. Skin texture natural, fabric weave visible. ISO 200, 1/500s motion freeze.

POST: Warm Mediterranean color grading, Kodak Portra 400 emulation. Yacht Life magazine aesthetic.`,
  negativePrompt: 'cold colors, indoor, formal clothing, bad weather'
}

// 3. Parisian Elegance - Кафе терраса
export const parisianElegance: PinGlassPrompt = {
  id: 'parisian-elegance',
  nameRU: 'Кафе терраса',
  nameEN: 'Parisian Elegance',
  category: 'lifestyle',
  tags: ['paris', 'cafe', 'morning', 'elegance', 'coffee'],
  prompt: `Shot on Leica Q3 with Summilux 28mm f/1.7 lens. Vogue Paris lifestyle editorial.

SUBJECT: Sophisticated figure seated at exclusive Parisian cafe terrace, morning light streaming through white awning. Impeccably tailored white linen shirt (crisp collar visible), stone-washed beige chinos. Hermès leather watch catching subtle sunlight. Relaxed posture, one arm elegantly draped over vintage rattan chair, refined genuine smile.

SETTING: Carrara marble bistro table, artisanal espresso in vintage Limoges cup. Background: romantic cobblestone Saint-Germain street, elegant passersby in soft motion blur, wrought iron balconies with flowers.

LIGHTING: Soft morning light (9 AM), diffused through canvas awning creating perfect fill. No harsh shadows, professional beauty lighting quality naturally achieved.

TECHNICAL: f/2.0 environmental portrait, subject sharp, background pleasantly blurred. Visible fabric texture, marble veining, coffee crema detail. ISO 400.

POST: Warm color grading, Fuji 400H film emulation, subtle dodge and burn. Harper's Bazaar Mediterranean editorial finish.`,
  negativePrompt: 'harsh shadows, indoor, evening, formal suit'
}

// 4. Urban Power - Городская улица
export const urbanPower: PinGlassPrompt = {
  id: 'urban-power',
  nameRU: 'Городская улица',
  nameEN: 'Urban Power',
  category: 'professional',
  tags: ['city', 'street', 'fashion', 'manhattan', 'blazer'],
  prompt: `Shot on Leica SL3 with APO-Summicron 75mm f/2 ASPH. GQ street style editorial.

SUBJECT: Confident figure striding purposefully down SoHo cobblestone street. Bespoke navy Tom Ford blazer over premium white t-shirt, dark selvedge Japanese denim, immaculate Common Projects white sneakers. Natural walking pose, left foot forward, strong eye contact with camera.

SETTING: Modern Manhattan architecture, glass buildings reflecting afternoon sun. Background pedestrians in artistic motion blur. Urban sophistication - coffee shop terraces, gallery entrances visible.

LIGHTING: Natural afternoon sunlight as rim light, glass reflections providing fill. Professional street photography quality.

TECHNICAL: f/2.0 subject isolation, tack-sharp eyes, fabric texture visible (wool weave, denim stitching). 1/250s motion freeze. Leica color science - rich, organic tonality.

POST: Cool-warm color split, subtle vignette, selective sharpening. The Sartorialist meets GQ editorial aesthetic.`,
  negativePrompt: 'static, indoor, casual, poor lighting'
}

// 5. Golden Hour Serenity - Парк на закате
export const goldenHourSerenity: PinGlassPrompt = {
  id: 'golden-hour-serenity',
  nameRU: 'Парк на закате',
  nameEN: 'Golden Hour Serenity',
  category: 'lifestyle',
  tags: ['park', 'sunset', 'relaxation', 'nature', 'sweater'],
  prompt: `Shot on Canon EOS R5 with RF 85mm f/1.2L lens. Elle lifestyle editorial.

SUBJECT: Peaceful figure sitting on weathered wooden park bench, golden hour magic. Cream cashmere knit sweater (cable knit visible), dark tailored fitted pants. Serene expression, looking slightly off-camera into warm light. Natural, approachable beauty.

SETTING: Lush green park, warm sunlight filtering through mature tree leaves creating dappled lighting patterns. Soft bokeh background of grass and distant trees.

LIGHTING: Golden hour perfection - warm directional light from side, natural rim lighting on hair. Soft shadows, luminous skin quality.

TECHNICAL: f/1.2 extreme shallow depth, subject razor-sharp, background creamy smooth. Sweater texture, leaf details in light. ISO 200.

POST: Warm golden color grading, enhanced highlights, natural skin retouching. Lifestyle campaign quality.`,
  negativePrompt: 'harsh midday sun, indoor, dark, cold colors'
}

// 6. Dawn Contemplation - Пляж на рассвете
export const dawnContemplation: PinGlassPrompt = {
  id: 'dawn-contemplation',
  nameRU: 'Пляж на рассвете',
  nameEN: 'Dawn Contemplation',
  category: 'outdoor',
  tags: ['beach', 'sunrise', 'ocean', 'minimal', 'linen'],
  prompt: `Shot on Fujifilm GFX 100 II with GF 80mm f/1.7 lens. Condé Nast Traveller editorial.

SUBJECT: Contemplative figure standing at water's edge, barefoot in pristine sand. Loose white linen pants billowing gently, light gray cashmere hoodie. Wind softly moving hair and fabric. Looking toward horizon, peaceful introspective mood.

SETTING: Dawn beach scene, soft pink and coral sky reflecting on calm glassy water. Minimalist composition - sand, sea, sky. No distracting elements.

LIGHTING: Soft pre-sunrise light, pink and orange tones. Even illumination, no harsh shadows. Ethereal quality.

TECHNICAL: Medium format sensor depth, f/1.7 environmental portrait. Sand grain texture, fabric movement frozen at 1/500s. ISO 400 low noise.

POST: Pastel color enhancement, film grain texture overlay. Kinfolk magazine aesthetic.`,
  negativePrompt: 'midday, crowds, busy background, harsh light'
}

// 7. Intellectual Warmth - Библиотека
export const intellectualWarmth: PinGlassPrompt = {
  id: 'intellectual-warmth',
  nameRU: 'Библиотека',
  nameEN: 'Intellectual Warmth',
  category: 'creative',
  tags: ['library', 'books', 'intellectual', 'cozy', 'glasses'],
  prompt: `Shot on Sony α1 with Sony FE 50mm f/1.2 GM lens. Monocle magazine portrait.

SUBJECT: Thoughtful figure seated in vintage leather Chesterfield armchair, holding open hardcover book. Round tortoiseshell Oliver Peoples glasses, dark green cashmere cardigan over crisp white Oxford shirt. Intellectual, comfortable expression.

SETTING: Atmospheric bookstore or private library. Tall mahogany shelves filled with leather-bound volumes. Brass library ladder visible, Persian rug on floor.

LIGHTING: Warm tungsten from vintage banker's lamps, soft window light fill. Rich golden tones, cozy atmosphere.

TECHNICAL: f/1.4 shallow depth, subject sharp against softly blurred book spines. Leather texture, wool knit visible. ISO 800 managed noise.

POST: Warm color grading, enhanced shadows, vintage warmth. Academic elegance aesthetic.`,
  negativePrompt: 'modern, bright, outdoor, casual'
}

// 8. Urban Nightlife - Крыша с видом на город
export const urbanNightlife: PinGlassPrompt = {
  id: 'urban-nightlife',
  nameRU: 'Крыша с видом на город',
  nameEN: 'Urban Nightlife',
  category: 'luxury',
  tags: ['rooftop', 'city', 'night', 'skyline', 'leather'],
  prompt: `Shot on Sony α1 with Sony FE 35mm f/1.4 GM lens at f/1.6. Esquire nightlife editorial.

SUBJECT: Confident figure leaning casually against brushed steel rooftop railing, blue hour city backdrop. Premium black Saint Laurent leather bomber jacket (visible grain texture), dark indigo Japanese selvedge denim, minimal black Chelsea boots. Relaxed yet powerful stance, slight confident smile.

SETTING: Luxury rooftop bar terrace, Manhattan skyline during blue hour. Empire State and Chrysler buildings visible in mid-ground (soft bokeh). Modern glass railing, polished concrete flooring.

LIGHTING: Blue hour ambient light mixed with warm city glow. LED panel fill camera-left for facial dimension. City lights creating perfect golden bokeh balls.

TECHNICAL: f/1.6 bokeh rendering, tack-sharp eyes, leather texture detail. ISO 1600 low-light performance. 1/200s motion freeze.

POST: Cinematic color grading - cool blue shadows, warm golden highlights. Film grain overlay. Peter McKinnon inspired aesthetic.`,
  negativePrompt: 'daylight, indoor, casual, poor city view'
}

// 9. Retro Americana - Винтажный автомобиль
export const retroAmericana: PinGlassPrompt = {
  id: 'retro-americana',
  nameRU: 'Винтажный автомобиль',
  nameEN: 'Retro Americana',
  category: 'lifestyle',
  tags: ['vintage', 'car', 'california', 'retro', 'classic'],
  prompt: `Shot on Leica M11 with Summilux 50mm f/1.4 ASPH. Vanity Fair lifestyle editorial.

SUBJECT: Stylish figure leaning against door of classic cream-colored 1960s Porsche 356. High-waisted vintage Levi's, tucked-in nautical striped Saint James shirt, tan leather Gucci loafers. Confident nostalgic pose, one hand in pocket.

SETTING: Sun-drenched suburban California street, palm trees and mid-century houses. Warm afternoon light, retro Americana aesthetic.

LIGHTING: Natural afternoon California sun, warm and golden. Soft shadows from nearby trees. Car paint reflecting light beautifully.

TECHNICAL: f/2.0 environmental portrait, subject and car sharp, background soft. Chrome details, fabric texture, car curves visible. ISO 200.

POST: Vintage film emulation (Kodachrome 64), warm highlights, faded shadows. 1960s editorial magazine aesthetic.`,
  negativePrompt: 'modern car, night, indoor, cold colors'
}

// 10. Creative Spirit - Художественная студия
export const creativeSpirit: PinGlassPrompt = {
  id: 'creative-spirit',
  nameRU: 'Художественная студия',
  nameEN: 'Creative Spirit',
  category: 'creative',
  tags: ['artist', 'studio', 'creative', 'paint', 'authentic'],
  prompt: `Shot on Nikon Z9 with Nikkor Z 58mm f/0.95 S Noct. W Magazine creative portrait.

SUBJECT: Artistic figure in authentic paint-splattered vintage denim overalls over black cashmere turtleneck. Natural thoughtful expression, perhaps holding brush mid-gesture. Creative energy, authentic artistic presence.

SETTING: Working artist's loft studio. Large abstract canvas in progress, professional easel, organized chaos of paint tubes and brushes. Large industrial windows, exposed brick walls.

LIGHTING: Natural north-facing window light, soft and even. Some warm accent from work lights. Dramatic but not harsh.

TECHNICAL: f/1.4 ultra-shallow depth, subject sharp against blurred studio. Paint texture, denim wear patterns, brush bristles visible. ISO 400.

POST: Slightly desaturated, emphasis on subject. Raw authentic atmosphere. Annie Leibovitz creative portrait style.`,
  negativePrompt: 'clean, formal, office, bright colorful'
}

// 11. Fall Editorial - Осенний лес
export const fallEditorial: PinGlassPrompt = {
  id: 'fall-editorial',
  nameRU: 'Осенний лес',
  nameEN: 'Fall Editorial',
  category: 'outdoor',
  tags: ['autumn', 'forest', 'fashion', 'coat', 'nature'],
  prompt: `Shot on Hasselblad X2D with XCD 90mm f/2.5 lens. Vogue autumn editorial.

SUBJECT: Elegant figure walking on leaf-covered forest path, surrounded by peak autumn foliage. Luxurious brown Max Mara wool coat, chunky cream cable-knit scarf. Peaceful expression, natural walking moment captured.

SETTING: Enchanting autumn forest, trees with vibrant orange, red, and golden leaves. Soft diffused light filtering through branches. Carpet of fallen leaves on path.

LIGHTING: Overcast autumn light, soft and even with no harsh shadows. Warm earth tones enhanced naturally.

TECHNICAL: Medium format depth and detail, f/2.5 subject isolation. Coat texture, leaf details, bark patterns visible. ISO 200.

POST: Warm autumn color grading, enhanced oranges and reds, subtle film grain. Fall fashion campaign aesthetic.`,
  negativePrompt: 'summer, green, urban, indoor'
}

// 12. Executive Power - Современный офис
export const executivePower: PinGlassPrompt = {
  id: 'executive-power',
  nameRU: 'Современный офис',
  nameEN: 'Executive Power',
  category: 'professional',
  tags: ['office', 'executive', 'business', 'suit', 'skyline'],
  prompt: `Shot on Sony α7R V with Zeiss Batis 85mm f/1.8 lens. Forbes executive portrait.

SUBJECT: Powerful figure in bespoke charcoal Tom Ford suit (peak lapels, visible stitching), white Egyptian cotton shirt, top button undone showing confidence. Strong posture standing by floor-to-ceiling window, city view behind. Success and ambition personified.

SETTING: Corner office 40th floor, Manhattan skyline through glass. Minimalist modern furniture - Herman Miller Eames chair, Noguchi table. Clean architectural lines.

LIGHTING: Three-point professional setup - large softbox key, white reflector fill, subtle rim light. Window light balanced with strobes.

TECHNICAL: f/2.0 executive portrait style, tack-sharp focus, background city soft. Suit fabric texture, skin natural. ISO 200.

POST: Cool professional color grading, subtle contrast, selective sharpening. Forbes/Fortune cover aesthetic.`,
  negativePrompt: 'casual, outdoor, poor lighting, cluttered'
}

// 13. Authentic Lifestyle - Фермерский рынок
export const authenticLifestyle: PinGlassPrompt = {
  id: 'authentic-lifestyle',
  nameRU: 'Фермерский рынок',
  nameEN: 'Authentic Lifestyle',
  category: 'lifestyle',
  tags: ['market', 'organic', 'natural', 'summer', 'authentic'],
  prompt: `Shot on Fujifilm X-T5 with XF 56mm f/1.2 R WR lens. Kinfolk lifestyle editorial.

SUBJECT: Natural figure examining organic heirloom tomatoes at artisan market stall. Relaxed floral sundress or light summer linen outfit, woven French market tote bag. Genuine candid smile, authentic moment of discovery.

SETTING: Colorful farmers market, vibrant displays of fresh produce - purple eggplants, orange carrots, green herbs. Striped awnings, handwritten price signs.

LIGHTING: Natural morning market light, dappled through awning. Warm and inviting, produce colors popping.

TECHNICAL: f/1.4 candid capture, subject sharp, produce beautiful bokeh. Vegetable textures, basket weave visible. ISO 400.

POST: Vibrant but natural colors, warm film emulation. Authentic lifestyle moment aesthetic.`,
  negativePrompt: 'supermarket, indoor, formal, posed'
}

// 14. Cinematic Mystery - Мост в тумане
export const cinematicMystery: PinGlassPrompt = {
  id: 'cinematic-mystery',
  nameRU: 'Мост в тумане',
  nameEN: 'Cinematic Mystery',
  category: 'creative',
  tags: ['fog', 'bridge', 'mystery', 'cinematic', 'noir'],
  prompt: `Shot on Leica SL2-S with APO-Summicron 50mm f/2 ASPH. Dazed magazine editorial.

SUBJECT: Mysterious figure on weathered stone bridge in morning fog. Long tailored dark Burberry coat, hands in pockets. Contemplative expression, emerging from or disappearing into mist.

SETTING: Old European bridge (Prague or Paris aesthetic), ornate iron railings dissolving into fog. Atmospheric, moody, cinematic.

LIGHTING: Soft diffused fog light, muted and ethereal. No direct sun, even mysterious illumination.

TECHNICAL: f/4.0 for fog depth, subject sharp, background fading to white. Coat wool texture, bridge stone detail. ISO 800.

POST: Desaturated muted palette, cool tones, film noir influence. Cinematic art house aesthetic.`,
  negativePrompt: 'sunny, colorful, modern bridge, bright'
}

// 15. Athletic Excellence - Спортивная площадка
export const athleticExcellence: PinGlassPrompt = {
  id: 'athletic-excellence',
  nameRU: 'Спортивная площадка',
  nameEN: 'Athletic Excellence',
  category: 'lifestyle',
  tags: ['sport', 'athletic', 'fitness', 'track', 'healthy'],
  prompt: `Shot on Canon EOS R3 with RF 85mm f/1.2L DS lens. Nike campaign editorial.

SUBJECT: Athletic figure on professional running track, dynamic mid-stretch pose. Premium fitted tank top, tailored joggers, pristine white trainers. Healthy glow, determined focused expression.

SETTING: Modern Olympic-standard track, red surface, white lane markings. Clean minimalist sports facility background.

LIGHTING: Golden hour side lighting, warm glow on skin, long shadows on track. Athletic dramatic effect.

TECHNICAL: f/1.8 sports portrait, subject frozen sharp, track lines leading. Muscle definition, fabric stretch visible. 1/1000s action freeze.

POST: Warm skin tones, enhanced contrast, athletic campaign finish. Sports Illustrated aesthetic.`,
  negativePrompt: 'indoor gym, night, static, casual clothing'
}

// 16. Domestic Warmth - Уютная кухня
export const domesticWarmth: PinGlassPrompt = {
  id: 'domestic-warmth',
  nameRU: 'Уютная кухня',
  nameEN: 'Domestic Warmth',
  category: 'lifestyle',
  tags: ['kitchen', 'home', 'cozy', 'morning', 'coffee'],
  prompt: `Shot on Sony α7 IV with Sony FE 35mm f/1.4 GM lens. Martha Stewart Living editorial.

SUBJECT: Warm approachable figure in bright modern kitchen, holding ceramic coffee mug with both hands. Comfortable soft cashmere sweater, relaxed linen pants. Natural morning smile, eyes catching window light.

SETTING: Bright Scandinavian-style kitchen, white marble counters, copper pots, fresh herbs in pots. Morning light streaming through large window.

LIGHTING: Natural window light as key, white surfaces providing fill. Warm and inviting, hygge atmosphere.

TECHNICAL: f/2.0 environmental portrait, subject sharp, kitchen pleasantly soft. Steam from coffee, sweater knit visible. ISO 400.

POST: Warm bright color grading, clean whites, natural skin. Lifestyle brand campaign aesthetic.`,
  negativePrompt: 'dark, messy, restaurant, formal'
}

// 17. Creative Musician - Музыкальная студия
export const creativeMusician: PinGlassPrompt = {
  id: 'creative-musician',
  nameRU: 'Музыкальная студия',
  nameEN: 'Creative Musician',
  category: 'creative',
  tags: ['music', 'studio', 'recording', 'creative', 'musician'],
  prompt: `Shot on Nikon Z8 with Nikkor Z 50mm f/1.2 S lens. Rolling Stone portrait.

SUBJECT: Creative musician figure in professional recording studio. Vintage band t-shirt, worn-in jeans, studio headphones around neck. Artistic expression, perhaps hand on vintage microphone or holding guitar neck.

SETTING: Professional recording studio, vintage Neumann microphone, mixing console visible. Colored accent lights - red, blue, purple. Acoustic panels on walls.

LIGHTING: Moody studio lighting, practical colored accents. Key light on face, artistic shadows. Creative atmosphere.

TECHNICAL: f/1.4 shallow depth, subject sharp, equipment bokeh with colored light circles. Fabric wear, instrument details. ISO 1600.

POST: Moody color grading, enhanced accent lights, film grain. Rock editorial aesthetic.`,
  negativePrompt: 'concert stage, daylight, formal, clean modern'
}

// 18. Zen Serenity - Японский сад
export const zenSerenity: PinGlassPrompt = {
  id: 'zen-serenity',
  nameRU: 'Японский сад',
  nameEN: 'Zen Serenity',
  category: 'outdoor',
  tags: ['japan', 'zen', 'garden', 'peaceful', 'minimal'],
  prompt: `Shot on Fujifilm GFX 50S II with GF 110mm f/2 lens. Wallpaper* magazine editorial.

SUBJECT: Serene figure in traditional Japanese garden setting. Minimalist outfit - black and white or earth tones, clean architectural lines in clothing. Peaceful meditative expression, perfect posture.

SETTING: Authentic Japanese garden - stone lanterns, perfectly manicured bushes, small arched bridge over koi pond. Raked gravel patterns.

LIGHTING: Soft overcast light, even and peaceful. No harsh shadows, zen tranquility in light quality.

TECHNICAL: Medium format precision, f/2.5 subject isolation. Garden textures - moss, stone, water reflections. ISO 200.

POST: Slightly muted colors, emphasis on greens and neutrals. Japanese aesthetic balance, wabi-sabi influence.`,
  negativePrompt: 'colorful, busy, western garden, harsh light'
}

// 19. Fine Dining Elegance - Ресторан высокой кухни
export const fineDiningElegance: PinGlassPrompt = {
  id: 'fine-dining-elegance',
  nameRU: 'Ресторан высокой кухни',
  nameEN: 'Fine Dining Elegance',
  category: 'luxury',
  tags: ['restaurant', 'fine dining', 'elegance', 'wine', 'romantic'],
  prompt: `Shot on Leica Q2 with Summilux 28mm f/1.7 lens. Michelin Guide editorial.

SUBJECT: Elegant figure at intimate upscale restaurant table. Sophisticated silk blouse or refined evening suit. Refined confident expression, wine glass held with grace.

SETTING: Exclusive fine dining restaurant, soft candlelight, white linen tablecloth, crystal wine glasses, subtle flower arrangement. Romantic intimate atmosphere.

LIGHTING: Warm candlelight as key, ambient restaurant glow fill. Soft romantic quality, skin luminous.

TECHNICAL: f/2.0 low-light mastery, subject sharp, restaurant atmosphere preserved. Crystal reflections, silk sheen, wine color visible. ISO 3200 managed.

POST: Warm intimate color grading, soft highlights, luxury atmosphere. Departures magazine aesthetic.`,
  negativePrompt: 'casual restaurant, daylight, fast food, crowded'
}

// 20. Adventure Achievement - Горный поход
export const adventureAchievement: PinGlassPrompt = {
  id: 'adventure-achievement',
  nameRU: 'Горный поход',
  nameEN: 'Adventure Achievement',
  category: 'outdoor',
  tags: ['hiking', 'mountain', 'summit', 'adventure', 'achievement'],
  prompt: `Shot on Nikon Z9 with Nikkor Z 24-70mm f/2.8 S at 50mm. Outside Magazine editorial.

SUBJECT: Accomplished figure on mountain summit, panoramic vista behind. Technical outdoor gear - premium Arc'teryx fleece, quality hiking boots, compact backpack. Standing on rocky outcrop, achievement pose, genuine joy.

SETTING: Dramatic mountain panorama, distant peaks, valley below. Clear sky, sense of altitude and accomplishment.

LIGHTING: High-altitude clear sunlight, natural and bright. Rim light from sun, fill from sky.

TECHNICAL: f/4.0 for landscape depth, subject sharp, mountains detailed but softer. Gear texture, rock detail, distant haze. ISO 200.

POST: Clear vibrant colors, enhanced landscape, adventure feeling. Patagonia campaign aesthetic.`,
  negativePrompt: 'indoor, urban, flat, poor weather'
}

// 21. Noir Romance - Дождливый город
export const noirRomance: PinGlassPrompt = {
  id: 'noir-romance',
  nameRU: 'Дождливый город',
  nameEN: 'Noir Romance',
  category: 'creative',
  tags: ['rain', 'city', 'night', 'cinematic', 'romantic'],
  prompt: `Shot on Sony α7S III with Sony FE 55mm f/1.8 ZA lens. Dior campaign editorial.

SUBJECT: Cinematic figure under clear umbrella on rainy city street. Tailored Burberry trench coat, sophisticated layering beneath. Contemplative romantic expression.

SETTING: Rainy evening city street, wet pavement reflecting warm shop window lights and cool street lamps. Moody urban noir atmosphere.

LIGHTING: Mixed color temperatures - cool blue ambient, warm shop windows creating accents. Reflections on wet surfaces adding depth.

TECHNICAL: f/2.0 night portrait, subject sharp, city lights beautiful bokeh. Rain visible, reflection details, coat water droplets. ISO 3200.

POST: Cinematic color grading - blue-orange contrast, film noir influence. Wong Kar-wai romantic urban aesthetic.`,
  negativePrompt: 'sunny, dry, daylight, casual clothing'
}

// 22. Sophisticated Connoisseur - Винный погреб
export const sophisticatedConnoisseur: PinGlassPrompt = {
  id: 'sophisticated-connoisseur',
  nameRU: 'Винный погреб',
  nameEN: 'Sophisticated Connoisseur',
  category: 'luxury',
  tags: ['wine', 'cellar', 'luxury', 'sophisticated', 'connoisseur'],
  prompt: `Shot on Leica M11 Monochrom with Noctilux 50mm f/0.95. Wine Spectator editorial.

SUBJECT: Refined figure in atmospheric wine cellar, holding wine glass examining color. Smart cashmere sweater, dark tailored pants. Sophisticated knowing expression, connoisseur moment.

SETTING: Historic wine cellar, rows of aging bottles on wooden racks, stone walls, brick archways. Dim candlelight or vintage bulbs.

LIGHTING: Warm low candlelight, dramatic shadows, intimate atmosphere. Wine glass catching light beautifully.

TECHNICAL: f/1.4 dramatic shallow depth, subject sharp, wine racks receding into blur. Wine color, glass reflections, cellar textures. ISO 1600.

POST: Rich warm tones, enhanced shadows, luxury atmosphere. Refined mature aesthetic.`,
  negativePrompt: 'bright, modern, bar, casual'
}

// 23. Coastal Prestige - Яхт-клуб
export const coastalPrestige: PinGlassPrompt = {
  id: 'coastal-prestige',
  nameRU: 'Яхт-клуб',
  nameEN: 'Coastal Prestige',
  category: 'luxury',
  tags: ['yacht club', 'marina', 'preppy', 'nautical', 'prestige'],
  prompt: `Shot on Hasselblad X2D with XCD 65mm f/2.8 lens. Town & Country editorial.

SUBJECT: Classic preppy figure at exclusive marina or yacht club. Striped Saint James shirt, white tailored pants, tan leather boat shoes. Confident relaxed pose, old-money elegance.

SETTING: Prestigious yacht club marina, white sailboats and classic wooden boats in background. Bright sunny day, blue sky and sparkling water.

LIGHTING: Perfect midday sun, clean bright light. White boats providing fill. Aspirational coastal luxury atmosphere.

TECHNICAL: Medium format clarity, f/4.0 environmental portrait. Boat details, rope textures, water sparkles. ISO 100 maximum clarity.

POST: Clean bright color grading, enhanced blues and whites, nautical freshness. Ralph Lauren campaign aesthetic.`,
  negativePrompt: 'commercial harbor, cloudy, night, casual'
}

// Export all prompts
export const allPinGlassPrompts: PinGlassPrompt[] = [
  alpineAdventure,
  coastalLuxury,
  parisianElegance,
  urbanPower,
  goldenHourSerenity,
  dawnContemplation,
  intellectualWarmth,
  urbanNightlife,
  retroAmericana,
  creativeSpirit,
  fallEditorial,
  executivePower,
  authenticLifestyle,
  cinematicMystery,
  athleticExcellence,
  domesticWarmth,
  creativeMusician,
  zenSerenity,
  fineDiningElegance,
  adventureAchievement,
  noirRomance,
  sophisticatedConnoisseur,
  coastalPrestige,
]

// Export pack metadata
export const PINGLASS = {
  id: 'pinglass',
  nameRU: 'PinGlass Premium',
  nameEN: 'PinGlass Premium',
  description: 'Оригинальная коллекция 23 журнальных промптов премиум качества (Vogue/GQ/Elle)',
  version: '1.0',
  totalPrompts: allPinGlassPrompts.length,
  categories: {
    outdoor: ['alpine-adventure', 'dawn-contemplation', 'fall-editorial', 'zen-serenity', 'adventure-achievement'],
    lifestyle: ['golden-hour-serenity', 'retro-americana', 'authentic-lifestyle', 'athletic-excellence', 'domestic-warmth'],
    professional: ['urban-power', 'executive-power'],
    creative: ['intellectual-warmth', 'creative-spirit', 'cinematic-mystery', 'creative-musician', 'noir-romance'],
    travel: ['coastal-luxury'],
    luxury: ['parisian-elegance', 'urban-nightlife', 'fine-dining-elegance', 'sophisticated-connoisseur', 'coastal-prestige'],
  },
  createdAt: new Date('2026-01-01'),
  prompts: allPinGlassPrompts,
}

export default PINGLASS
