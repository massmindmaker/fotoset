/**
 * DREAM PACK - Премиум коллекция промптов
 * 12 сценариев с V2 вариантами
 * Created: 2025-12-31
 */

export interface DreampackPrompt {
  id: string
  nameRU: string
  nameEN: string
  version: 'V1' | 'V2'
  prompt: string
  negativePrompt?: string
  category: 'outdoor' | 'luxury' | 'creative' | 'action' | 'animals'
  tags: string[]
}

// 1. СИДЯ НА ЛАВОЧКЕ (Bench in Park)
export const benchInPark: DreampackPrompt = {
  id: 'bench-in-park',
  nameRU: 'Сидя на лавочке',
  nameEN: 'Bench in Park',
  version: 'V1',
  category: 'outdoor',
  tags: ['park', 'relaxation', 'nature', 'lifestyle'],
  prompt: `A high-quality photograph of a subject in a casual, relaxed pose sitting on a wooden park bench. The subject has a natural, friendly expression, dressed in comfortable smart-casual attire (like chinos and a light sweater or linen shirt). Warm afternoon sunlight filters through lush green tree canopy creating dappled shadows. The background shows a well-maintained city park with blurred greenery, flowers, and walking paths. Professional photography, Canon EOS R5, 85mm f/1.4 lens for beautiful bokeh, golden hour lighting, soft shadows on face, natural skin texture, editorial lifestyle photography style.`,
  negativePrompt: 'blur, low quality, distorted, bad anatomy, artificial lighting, harsh shadows'
}

// 2. Мотогонщик (Motorcycle Racer) V1
export const motorcycleRacerV1: DreampackPrompt = {
  id: 'motorcycle-racer-v1',
  nameRU: 'Мотогонщик',
  nameEN: 'Motorcycle Racer',
  version: 'V1',
  category: 'action',
  tags: ['motorcycle', 'racing', 'speed', 'action', 'sport'],
  prompt: `Ultra-dynamic photograph of a subject as a professional motorcycle racer in mid-corner lean on a racing circuit. Subject wearing full racing leathers with sponsor logos, Arai or Shoei helmet with visor up showing intense focused expression. Motorcycle is a modern superbike (like Ducati Panigale or Yamaha R1) at extreme lean angle, knee slider touching asphalt with sparks. Motion blur on background showing racing circuit, grandstands visible. Shot with high-speed camera Canon 1DX Mark III, 70-200mm f/2.8, 1/2000s shutter capturing every detail while background blurs with speed. Dramatic afternoon lighting, professional motorsport photography, MotoGP quality.`,
  negativePrompt: 'static, blurry subject, fake motorcycle, unrealistic lean angle, cartoon style'
}

// 2. Мотогонщик V2
export const motorcycleRacerV2: DreampackPrompt = {
  id: 'motorcycle-racer-v2',
  nameRU: 'Мотогонщик',
  nameEN: 'Motorcycle Racer',
  version: 'V2',
  category: 'action',
  tags: ['motorcycle', 'racing', 'speed', 'action', 'sport'],
  prompt: `Cinematic photograph of a subject on a cafe racer motorcycle, stopped dramatically on a scenic mountain road at sunset. Subject wearing vintage-style open-face helmet with goggles pushed up, leather jacket with racing stripes, looking confidently at camera. Custom BMW R nineT or Triumph Thruxton cafe racer gleaming in golden hour light. Background shows dramatic mountain curves, valley vista with warm sunset colors. Shot on Hasselblad H6D, 50mm lens, rich colors, film-like quality with slight grain. Classic motorsport aesthetic meets lifestyle photography.`,
  negativePrompt: 'blur, modern racing suit, closed helmet, generic background'
}

// 3. Рокер (Rock Star) V1
export const rockStarV1: DreampackPrompt = {
  id: 'rock-star-v1',
  nameRU: 'Рокер',
  nameEN: 'Rock Star',
  version: 'V1',
  category: 'creative',
  tags: ['music', 'rock', 'concert', 'guitar', 'stage'],
  prompt: `Epic concert photograph of subject as a rock star on stage, mid-performance with electric guitar. Subject wearing leather jacket with studs, band t-shirt, dark jeans, silver rings and bracelets. Dramatic stage lighting with red and purple spotlights, lens flares, smoke machine effects in background. Crowd silhouettes visible raising hands. Guitar is a classic Gibson Les Paul or Fender Stratocaster, subject caught in passionate playing pose with hair slightly in motion. Shot from low angle emphasizing power and presence. Professional concert photography, Canon EOS R3, 24-70mm f/2.8, high ISO capturing atmosphere, rock and roll energy.`,
  negativePrompt: 'daylight, empty stage, acoustic guitar, formal clothing, static pose'
}

// 3. Рокер V2
export const rockStarV2: DreampackPrompt = {
  id: 'rock-star-v2',
  nameRU: 'Рокер',
  nameEN: 'Rock Star',
  version: 'V2',
  category: 'creative',
  tags: ['music', 'rock', 'studio', 'guitar', 'recording'],
  prompt: `Intimate studio portrait of subject as a musician in professional recording studio. Subject seated with acoustic guitar, wearing vintage band tee, relaxed fit jeans, bare feet. Warm studio lighting from vintage lamps, expensive recording equipment and mixing console visible in background. Subject looking thoughtfully at camera or down at guitar, creative and contemplative mood. Recording studio aesthetic with soundproofing panels, hanging platinum records on wall, analog equipment. Shot on Sony A7R V, 35mm f/1.4, shallow depth of field, warm color grading reminiscent of album cover photography.`,
  negativePrompt: 'stage, concert, bright lights, crowd, electric guitar only'
}

// 4. Роллс Ройс (Rolls Royce Arrival)
export const rollsRoyceArrival: DreampackPrompt = {
  id: 'rolls-royce-arrival',
  nameRU: 'Роллс Ройс',
  nameEN: 'Rolls Royce Arrival',
  version: 'V1',
  category: 'luxury',
  tags: ['luxury', 'car', 'wealth', 'elegance', 'arrival'],
  prompt: `Sophisticated photograph of subject stepping out of a Rolls Royce Phantom or Cullinan at a luxury venue entrance. Subject wearing impeccably tailored dark suit or evening gown, confident expression. The Rolls Royce's suicide doors are elegantly open, starlight headliner visible inside. Background shows upscale hotel entrance or luxury event venue with subtle evening lighting. Professional chauffeur in background, red carpet visible. Shot at dusk with ambient lighting from venue, capturing both luxury of vehicle and elegance of subject. Hasselblad medium format quality, shallow depth of field, rich blacks and warm highlights. Editorial luxury lifestyle photography.`,
  negativePrompt: 'cheap car, bright daylight, casual clothing, ordinary background'
}

// 5. Со львом (With Lion) V1
export const withLionV1: DreampackPrompt = {
  id: 'with-lion-v1',
  nameRU: 'Со львом',
  nameEN: 'With Lion',
  version: 'V1',
  category: 'animals',
  tags: ['lion', 'wildlife', 'safari', 'africa', 'majestic'],
  prompt: `Breathtaking photograph of subject seated beside a majestic male lion in African savanna setting. Subject wearing safari-style khaki clothing (linen shirt, cargo pants), looking calmly at camera while the lion sits regally nearby. Golden hour African light, acacia trees silhouetted in background, vast savanna landscape. The lion has magnificent full mane, peaceful but powerful presence. Both subject and lion appear relaxed and harmonious. Shot on Phase One IQ4, 85mm lens, incredible detail and dynamic range capturing golden savanna colors. National Geographic quality wildlife portrait with human subject.`,
  negativePrompt: 'zoo, cage, aggressive lion, artificial setting, flash photography'
}

// 5. Со львом V2
export const withLionV2: DreampackPrompt = {
  id: 'with-lion-v2',
  nameRU: 'Со львом',
  nameEN: 'With Lion',
  version: 'V2',
  category: 'animals',
  tags: ['lion', 'wildlife', 'studio', 'regal', 'portrait'],
  prompt: `Dramatic studio portrait of subject with a majestic lion, both facing camera in powerful compositional arrangement. Subject wearing elegant dark clothing that doesn't compete with lion's golden fur. Deep black studio background, professional lighting creating dramatic shadows and highlights on both subjects. Lion's mane is full and luxurious, eyes bright and alert. The image conveys power, courage, and connection between human and animal kingdom. Shot with medium format camera, 100mm lens, precise studio lighting with key light and rim lights. Fine art portrait style, museum quality print.`,
  negativePrompt: 'outdoor, daylight, casual clothing, aggressive pose, motion blur'
}

// 6. РЕГАТА (Yacht Racing)
export const yachtRacing: DreampackPrompt = {
  id: 'yacht-racing',
  nameRU: 'Регата',
  nameEN: 'Yacht Racing',
  version: 'V1',
  category: 'luxury',
  tags: ['yacht', 'sailing', 'ocean', 'regatta', 'sport'],
  prompt: `Action-packed sailing photograph of subject at the helm of a racing yacht during competitive regatta. Subject wearing high-end sailing gear (Henri Lloyd or Helly Hansen), polarized sunglasses, focused expression looking at sails. Yacht heeled dramatically, spray flying, colorful spinnaker fully deployed. Deep blue Mediterranean or Caribbean waters, other racing yachts visible in background. Bright sunny conditions with puffy white clouds. Professional sailing photography, captured from chase boat with Canon EOS R5, 70-200mm f/2.8, high shutter speed freezing water spray. Americas Cup or Volvo Ocean Race quality imagery.`,
  negativePrompt: 'calm water, powerboat, casual clothing, anchored yacht'
}

// 7. ПРЫЖОК В ДУБАЕ (Dubai Skydive)
export const dubaiSkydive: DreampackPrompt = {
  id: 'dubai-skydive',
  nameRU: 'Прыжок в Дубае',
  nameEN: 'Dubai Skydive',
  version: 'V1',
  category: 'action',
  tags: ['skydiving', 'dubai', 'extreme', 'action', 'palm'],
  prompt: `Incredible freefall photograph of subject skydiving over Dubai with Palm Jumeirah clearly visible below. Subject in tandem or solo skydive position, wearing professional jumpsuit with goggles and altimeter. Expression of pure exhilaration and joy. Dubai skyline with Burj Al Arab, Atlantis The Palm, and The Palm formation visible from 10,000 feet. Crystal clear day, bright blue sky, sun lighting subject from above. Shot by helmet-mounted GoPro and professional skydive photographer companion. Sharp subject, stunning aerial view of Dubai's iconic landmarks. Extreme sports photography at its finest.`,
  negativePrompt: 'cloudy, night, blurry subject, indoor skydiving, random location'
}

// 8. ПОВАР (Chef with Flambe)
export const chefFlambe: DreampackPrompt = {
  id: 'chef-flambe',
  nameRU: 'Повар',
  nameEN: 'Chef with Flambe',
  version: 'V1',
  category: 'creative',
  tags: ['chef', 'cooking', 'kitchen', 'flambe', 'culinary'],
  prompt: `Dynamic photograph of subject as a professional chef performing flambé in upscale restaurant kitchen. Subject wearing crisp white chef's coat, traditional toque (chef's hat), focused concentrated expression. Dramatic flames rising from pan, illuminating subject's face with warm orange glow. Professional kitchen environment with stainless steel, copper pots, mise en place visible. Other chefs working in background, creating authentic kitchen atmosphere. Shot at the moment of flame ignition, capturing fire, steam, and movement. Canon EOS R5, 35mm f/1.4, high ISO handling low kitchen light with flambe as key light. Culinary arts photography.`,
  negativePrompt: 'home kitchen, casual clothing, no flames, static pose'
}

// 9. АРХЕОЛОГ (Archaeologist in Tomb)
export const archaeologistTomb: DreampackPrompt = {
  id: 'archaeologist-tomb',
  nameRU: 'Археолог',
  nameEN: 'Archaeologist in Tomb',
  version: 'V1',
  category: 'creative',
  tags: ['archaeology', 'adventure', 'history', 'discovery', 'explorer'],
  prompt: `Cinematic photograph of subject as an archaeologist in ancient Egyptian tomb, moment of discovery. Subject wearing classic field archaeologist clothing - khaki shirt with rolled sleeves, leather satchel, fedora-style hat (Indiana Jones inspired). Holding torch illuminating hieroglyphic-covered walls, ancient artifacts partially visible in foreground. Dramatic chiaroscuro lighting from torch, dust particles visible in light beam. Expression of wonder and excitement at historical discovery. Shot like a still from an adventure film, rich warm tones contrasting with cool shadows. Arri Alexa cinema camera quality, 35mm anamorphic lens, film grain.`,
  negativePrompt: 'modern building, bright daylight, tourist, casual clothing, clean environment'
}

// 10. ВЕРТОЛЁТНАЯ ПЛОЩАДКА (Helipad Arrival) V1
export const helipadArrivalV1: DreampackPrompt = {
  id: 'helipad-arrival-v1',
  nameRU: 'Вертолётная площадка',
  nameEN: 'Helipad Arrival',
  version: 'V1',
  category: 'luxury',
  tags: ['helicopter', 'luxury', 'skyscraper', 'executive', 'arrival'],
  prompt: `Executive lifestyle photograph of subject exiting private helicopter on skyscraper rooftop helipad. Subject wearing tailored business attire, hair slightly windswept from rotor wash, confident purposeful stride. Luxury helicopter (Augusta or Bell) with rotors still spinning behind. City skyline dramatic in background (Dubai, Hong Kong, or Monaco style). Sunset or sunrise lighting creating warm rim light around subject and aircraft. Shot from helipad level capturing both subject's power pose and helicopter elegance. Professional executive portrait, Phase One camera, wide angle capturing scene grandeur.`,
  negativePrompt: 'ground level, small helicopter, casual clothing, poor weather'
}

// 10. ВЕРТОЛЁТНАЯ ПЛОЩАДКА V2
export const helipadArrivalV2: DreampackPrompt = {
  id: 'helipad-arrival-v2',
  nameRU: 'Вертолётная площадка',
  nameEN: 'Helipad Arrival',
  version: 'V2',
  category: 'luxury',
  tags: ['helicopter', 'luxury', 'yacht', 'executive', 'ocean'],
  prompt: `Luxury photograph of subject on superyacht helipad with helicopter approaching or departing in background. Subject wearing elegant resort wear (linen blazer, white pants, boat shoes), standing confidently on pristine white helipad. Massive superyacht deck visible, deep blue ocean and coastline in background. Helicopter (black or white executive model) either landing or just departed, creating cinematic backdrop. Mediterranean or Caribbean setting, perfect sunny day. Shot from yacht structure, capturing scale and luxury of scene. Professional lifestyle photography, Hasselblad quality.`,
  negativePrompt: 'small boat, crowded, rain, casual tourist appearance'
}

// 11. СЁРФЕР НА ВОЛНЕ (Surfer in Barrel)
export const surferBarrel: DreampackPrompt = {
  id: 'surfer-barrel',
  nameRU: 'Сёрфер на волне',
  nameEN: 'Surfer in Barrel',
  version: 'V1',
  category: 'action',
  tags: ['surfing', 'ocean', 'wave', 'extreme', 'sport'],
  prompt: `Legendary surf photograph of subject riding inside a perfect barrel wave. Subject on shortboard in tube riding position, hand touching wave face, expression of pure stoke and concentration. Crystal clear turquoise water curling overhead, light refracting through wave creating magical tunnel effect. Tropical location (Pipeline, Teahupo'o, or Mentawai style wave). Water photographer position, shot from inside the barrel looking back at surfer. Sharp image despite challenging conditions, perfect timing capturing surfer in critical section. Canon EOS R3 in water housing, 15mm fisheye, peak action surf photography.`,
  negativePrompt: 'flat water, longboard, beginner, wipeout, cloudy water'
}

// 12. НА БОРТУ ДЖЕТА (Private Jet) V1
export const privateJetV1: DreampackPrompt = {
  id: 'private-jet-v1',
  nameRU: 'На борту джета',
  nameEN: 'Private Jet',
  version: 'V1',
  category: 'luxury',
  tags: ['jet', 'private', 'luxury', 'travel', 'executive'],
  prompt: `Luxurious photograph of subject seated in private jet cabin, working on laptop or enjoying champagne. Subject wearing smart business casual or elegant loungewear, relaxed but sophisticated pose. Interior of Gulfstream G650 or Bombardier Global showing cream leather seats, wood veneer details, ambient lighting. Large cabin windows showing clouds at altitude or tarmac at sunset. Crystal champagne flute, leather portfolio on table. Shot with wide angle to capture cabin luxury, shallow depth of field on subject. Professional lifestyle photography, warm intimate lighting, aspirational travel imagery.`,
  negativePrompt: 'commercial plane, cramped space, economy class, night only'
}

// 12. НА БОРТУ ДЖЕТА V2
export const privateJetV2: DreampackPrompt = {
  id: 'private-jet-v2',
  nameRU: 'На борту джета',
  nameEN: 'Private Jet',
  version: 'V2',
  category: 'luxury',
  tags: ['jet', 'private', 'luxury', 'travel', 'boarding'],
  prompt: `Aspirational photograph of subject walking up stairs of private jet, about to board. Subject wearing tailored travel ensemble (blazer, quality luggage), looking back at camera with confident smile. Private jet (Gulfstream or similar) parked on private terminal tarmac, sunset or golden hour lighting creating warm atmosphere. Flight crew visible at aircraft door. Subject's designer luggage being loaded. VIP terminal building in background. Shot from tarmac level, emphasizing subject's power pose and jet's elegant lines. Luxury travel editorial photography style.`,
  negativePrompt: 'commercial terminal, crowds, old aircraft, poor lighting'
}

// Export all prompts
export const allDreampackPrompts: DreampackPrompt[] = [
  benchInPark,
  motorcycleRacerV1,
  motorcycleRacerV2,
  rockStarV1,
  rockStarV2,
  rollsRoyceArrival,
  withLionV1,
  withLionV2,
  yachtRacing,
  dubaiSkydive,
  chefFlambe,
  archaeologistTomb,
  helipadArrivalV1,
  helipadArrivalV2,
  surferBarrel,
  privateJetV1,
  privateJetV2,
]

// Export pack metadata
export const DREAMPACK = {
  id: 'dreampack',
  nameRU: 'DREAM PACK',
  nameEN: 'Dream Pack',
  description: 'Премиум коллекция из 12 сценариев мечты с вариантами',
  version: '1.0',
  totalPrompts: allDreampackPrompts.length,
  baseScenes: 12,
  withV2Variants: 5, // motorcycle, rock, lion, helipad, jet
  categories: {
    outdoor: ['bench-in-park'],
    luxury: ['rolls-royce-arrival', 'yacht-racing', 'helipad-arrival-v1', 'helipad-arrival-v2', 'private-jet-v1', 'private-jet-v2'],
    creative: ['rock-star-v1', 'rock-star-v2', 'chef-flambe', 'archaeologist-tomb'],
    action: ['motorcycle-racer-v1', 'motorcycle-racer-v2', 'dubai-skydive', 'surfer-barrel'],
    animals: ['with-lion-v1', 'with-lion-v2'],
  },
  createdAt: new Date('2025-12-31'),
  prompts: allDreampackPrompts,
}

export default DREAMPACK
