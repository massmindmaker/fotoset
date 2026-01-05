/**
 * Shared types for view components
 */

export interface PricingTier {
  id: string
  photos: number
  price: number           // Current price (after discount)
  originalPrice?: number  // Original price before discount
  discount?: number       // Discount percentage (0-100)
  popular?: boolean
}

export interface UploadedImage {
  id: string
  file: File
  previewUrl: string
}

export interface GeneratedAsset {
  id: string
  type: "PHOTO"
  url: string
  styleId: string
  prompt?: string
  createdAt: number
}

export interface Persona {
  id: string
  name: string
  status: "draft" | "processing" | "ready"
  images: UploadedImage[]
  generatedAssets: GeneratedAsset[]
  thumbnailUrl?: string
  referenceCount?: number
}

export type ViewState =
  | { view: "ONBOARDING" }
  | { view: "DASHBOARD" }
  | { view: "CREATE_PERSONA_UPLOAD"; personaId: string }
  | { view: "SELECT_TIER"; personaId: string }
  | { view: "RESULTS"; personaId: string }
  | { view: "AVATAR_DETAIL"; personaId: string }

export interface ReferencePhoto {
  id: number
  imageUrl: string
  createdAt: string
}

export interface GenerationProgress {
  completed: number
  total: number
  startPhotoCount?: number // Number of photos at generation start (for re-generation)
}
