// Reference Image Processing and Selection
// Optimizes user photos for best generation results

import type { ReferenceImageScore } from '../types';
import { BATCH_DEFAULTS } from '../config';

/**
 * Calculate quality score for a reference image
 * Higher score = better quality for face generation
 */
export function calculateImageScore(base64Image: string): number {
  let score = 50; // Base score

  // Check for data URI prefix
  const hasDataUri = base64Image.startsWith('data:image/');
  const imageData = hasDataUri
    ? base64Image.split(',')[1] || base64Image
    : base64Image;

  // Size analysis (larger generally better, up to a point)
  const sizeBytes = imageData.length * 0.75;
  const sizeKb = sizeBytes / 1024;

  if (sizeKb > 1000) {
    score += 20; // Large, high quality
  } else if (sizeKb > 500) {
    score += 15;
  } else if (sizeKb > 200) {
    score += 10;
  } else if (sizeKb > 50) {
    score += 5;
  } else if (sizeKb < 20) {
    score -= 20; // Too small, likely low quality
  }

  // Format preference (JPEG most common for photos)
  if (hasDataUri) {
    if (base64Image.includes('image/jpeg')) {
      score += 5; // JPEG photos typically good quality
    } else if (base64Image.includes('image/png')) {
      score += 3; // PNG can be high quality
    } else if (base64Image.includes('image/webp')) {
      score += 4;
    }
  } else {
    // Check magic bytes
    if (imageData.startsWith('/9j/')) {
      score += 5; // JPEG
    } else if (imageData.startsWith('iVBOR')) {
      score += 3; // PNG
    }
  }

  // Penalize very large files (might be problematic)
  if (sizeKb > 5000) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Score and rank all reference images
 */
export function scoreReferenceImages(images: string[]): ReferenceImageScore[] {
  return images
    .map((image, index) => ({
      image,
      index,
      score: calculateImageScore(image),
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Select best reference images for generation
 */
export function selectBestReferences(
  images: string[],
  maxCount: number = BATCH_DEFAULTS.topReferencesToUse
): string[] {
  const scored = scoreReferenceImages(images);
  return scored.slice(0, maxCount).map(s => s.image);
}

/**
 * Rotate through reference images for batch variety
 * Uses top N images and cycles through them per batch
 */
export function rotateReference(
  sortedImages: string[],
  batchIndex: number
): string {
  if (sortedImages.length === 0) {
    throw new Error('No reference images available');
  }

  // Cycle through available images
  const index = batchIndex % sortedImages.length;
  return sortedImages[index];
}

/**
 * Prepare image for Replicate API
 * Ensures proper data URI format
 */
export function prepareImageForApi(base64Image: string): string {
  // Already a data URI
  if (base64Image.startsWith('data:image/')) {
    return base64Image;
  }

  // Already a URL
  if (base64Image.startsWith('http://') || base64Image.startsWith('https://')) {
    return base64Image;
  }

  // Check for JPEG magic bytes
  if (base64Image.startsWith('/9j/')) {
    return `data:image/jpeg;base64,${base64Image}`;
  }

  // Check for PNG magic bytes
  if (base64Image.startsWith('iVBOR')) {
    return `data:image/png;base64,${base64Image}`;
  }

  // Default to JPEG
  return `data:image/jpeg;base64,${base64Image}`;
}

/**
 * Convert data URI or base64 string to Buffer for Replicate SDK
 * Replicate SDK automatically uploads Buffer objects to their servers
 */
export function dataUriToBuffer(base64Image: string): Buffer {
  // Extract base64 data from data URI
  let base64Data: string;

  if (base64Image.startsWith('data:')) {
    // Data URI format: data:image/jpeg;base64,/9j/4AAQ...
    const parts = base64Image.split(',');
    base64Data = parts[1] || parts[0];
  } else if (base64Image.startsWith('http://') || base64Image.startsWith('https://')) {
    // For URLs, throw error - should not convert URLs to Buffer
    throw new Error('Cannot convert URL to Buffer - URLs should be passed directly');
  } else {
    // Already raw base64
    base64Data = base64Image;
  }

  return Buffer.from(base64Data, 'base64');
}

/**
 * Prepare images as Buffer array for Replicate models that need upload
 * Used by nano-banana-pro and other models that require server-side image processing
 */
export function prepareImagesAsBuffers(images: string[]): Buffer[] {
  return images.map(img => {
    // Skip URLs - they don't need conversion
    if (img.startsWith('http://') || img.startsWith('https://')) {
      throw new Error('URL images should be handled separately');
    }
    return dataUriToBuffer(img);
  });
}

/**
 * Validate reference image
 */
export interface ImageValidation {
  valid: boolean;
  issues: string[];
  sizeKb: number;
  format: string | null;
}

export function validateReferenceImage(base64Image: string): ImageValidation {
  const issues: string[] = [];

  // Extract raw base64 data
  const imageData = base64Image.startsWith('data:')
    ? base64Image.split(',')[1] || ''
    : base64Image;

  // Size check
  const sizeBytes = imageData.length * 0.75;
  const sizeKb = Math.round(sizeBytes / 1024);

  if (sizeKb < 10) {
    issues.push('Image too small (< 10KB)');
  }
  if (sizeKb > 10240) {
    issues.push('Image too large (> 10MB)');
  }

  // Format detection
  let format: string | null = null;

  if (base64Image.startsWith('data:image/jpeg') || imageData.startsWith('/9j/')) {
    format = 'jpeg';
  } else if (base64Image.startsWith('data:image/png') || imageData.startsWith('iVBOR')) {
    format = 'png';
  } else if (base64Image.startsWith('data:image/webp')) {
    format = 'webp';
  } else if (base64Image.startsWith('http')) {
    format = 'url';
  } else {
    issues.push('Unknown image format');
  }

  return {
    valid: issues.length === 0,
    issues,
    sizeKb,
    format,
  };
}

/**
 * Filter and prepare reference images for generation
 */
export function prepareReferenceImages(
  images: string[],
  maxImages: number = BATCH_DEFAULTS.maxReferenceImages
): {
  prepared: string[];
  rejected: Array<{ index: number; reason: string }>;
  topReferences: string[];
} {
  const rejected: Array<{ index: number; reason: string }> = [];
  const validated: Array<{ image: string; index: number; score: number }> = [];

  // Validate each image
  for (let i = 0; i < images.length; i++) {
    const validation = validateReferenceImage(images[i]);

    if (!validation.valid) {
      rejected.push({ index: i, reason: validation.issues.join(', ') });
    } else {
      validated.push({
        image: prepareImageForApi(images[i]),
        index: i,
        score: calculateImageScore(images[i]),
      });
    }
  }

  // Sort by quality and limit
  const sorted = validated
    .sort((a, b) => b.score - a.score)
    .slice(0, maxImages);

  return {
    prepared: sorted.map(v => v.image),
    rejected,
    topReferences: sorted.slice(0, BATCH_DEFAULTS.topReferencesToUse).map(v => v.image),
  };
}
