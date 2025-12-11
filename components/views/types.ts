/**
 * Shared types for view components
 */

export interface PricingTier {
  id: string
  photos: number
  price: number
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
}

export type ViewState =
  | { view: "ONBOARDING" }
  | { view: "DASHBOARD" }
  | { view: "CREATE_PERSONA_UPLOAD"; personaId: string }
  | { view: "SELECT_TIER"; personaId: string }
  | { view: "RESULTS"; personaId: string }

export interface GenerationProgress {
  completed: number
  total: number
}
