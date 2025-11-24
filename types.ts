export interface UploadedImage {
  id: string;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

export interface GeneratedAsset {
  id: string;
  type: 'VIDEO' | 'PHOTO';
  url: string;
  styleId: string; // Link to the style used
  createdAt: number;
}

export interface Persona {
  id: string;
  name: string;
  status: 'draft' | 'ready' | 'processing';
  thumbnailUrl?: string; // Cover image for the avatar card
  images: UploadedImage[];
  generatedAssets: GeneratedAsset[];
}

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  prompt: string; // The base prompt for Gemini
  type: 'PHOTO' | 'VIDEO';
  isNew?: boolean;
  isPopular?: boolean;
  requiresPro?: boolean;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: number; // in RUB
  features: string[];
  credits: number;
  isPopular?: boolean;
}

export type ViewState = 
  | { view: 'DASHBOARD' }
  | { view: 'CREATE_PERSONA_UPLOAD'; personaId: string }
  | { view: 'SELECT_STYLE'; personaId: string }
  | { view: 'RESULTS'; personaId: string };