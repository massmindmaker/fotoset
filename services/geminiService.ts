import { GoogleGenAI, VideoGenerationReferenceImage, VideoGenerationReferenceType } from "@google/genai";
import { StylePreset, UploadedImage } from "../types";

const getClient = async (): Promise<GoogleGenAI> => {
  // Always create a new instance to ensure we use the latest key from the environment/dialog
  // checkApiKey should be handled before calling this, but we double check implicitly by using the env var
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const openApiKeySelection = async () => {
  if (window.aistudio && window.aistudio.openSelectKey) {
    await window.aistudio.openSelectKey();
  }
};

export const checkApiKey = async (): Promise<boolean> => {
    if(window.aistudio && window.aistudio.hasSelectedApiKey) {
        return await window.aistudio.hasSelectedApiKey();
    }
    return false;
};

// Helper to handle API specific errors regarding quota and permissions
const handleApiError = async (error: any) => {
    // Try to stringify if it's an object to catch nested error messages from JSON response
    let errorMsg = '';
    
    if (typeof error === 'string') {
        errorMsg = error.toLowerCase();
    } else if (error instanceof Error) {
        errorMsg = error.message.toLowerCase();
        // Sometimes the message is just "Error", check stack or other props if available, 
        // but often the relevant info is in the stringified version of the object that caused the error
    } 
    
    // Combine standard message with JSON stringification to catch raw API errors like {"error": {"code": 403...}}
    try {
        const jsonString = JSON.stringify(error).toLowerCase();
        errorMsg += ' ' + jsonString;
    } catch (e) {
        // ignore circular structure errors
    }
    
    // Check for Quota Exceeded (429) or Permission Denied (403)
    // "limit: 0" specifically indicates Free Tier trying to access Pro/Paid-only features
    if (
        errorMsg.includes('429') || 
        errorMsg.includes('403') || 
        errorMsg.includes('quota') || 
        errorMsg.includes('permission_denied') || 
        errorMsg.includes('resource_exhausted') ||
        errorMsg.includes('limit: 0') 
    ) {
        console.warn("Quota exceeded or permission denied. Prompting for new key.");
        // Reset/Re-prompt for key selection
        await openApiKeySelection();
        // We throw a very specific error to guide the user in the UI
        throw new Error("⚠️ Google API Billing Required. You are using a Free Tier key which does not support these advanced models (Gemini 1.5/3.0 Pro Vision, Veo). Please select a Google Cloud Project with Billing enabled.");
    }
    
    // Check for "Requested entity was not found" (sometimes happens with invalid keys/regions)
    if (errorMsg.includes('requested entity was not found') || errorMsg.includes('not found')) {
         await openApiKeySelection();
         throw new Error("Model or Key not found. Please select a valid API Key.");
    }

    throw error;
};

/**
 * Generates a video using Veo model based on a style preset and reference images.
 */
export const generateVideo = async (
  style: StylePreset,
  referenceImages: UploadedImage[]
): Promise<string> => {
  try {
      const ai = await getClient();
      
      // Pick top 3 images for reference to maintain consistency but not overload the model
      const refs: VideoGenerationReferenceImage[] = referenceImages.slice(0, 3).map(img => ({
        image: {
          imageBytes: img.base64,
          mimeType: img.mimeType,
        },
        referenceType: VideoGenerationReferenceType.ASSET,
      }));

      // Enhance prompt with style
      const fullPrompt = `${style.prompt}. The character in the video must resemble the provided reference images. High quality, cinematic.`;

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: fullPrompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9',
          referenceImages: refs,
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      if (operation.response?.generatedVideos?.[0]?.video?.uri) {
         return `${operation.response.generatedVideos[0].video.uri}&key=${process.env.API_KEY}`;
      } else {
          throw new Error("Video generation failed.");
      }
  } catch (error) {
      await handleApiError(error);
      return ""; // Should not reach here due to throw in handleApiError
  }
};

/**
 * Generates images using Gemini 3 Pro based on a style preset and reference images.
 */
export const generateImages = async (
  style: StylePreset,
  referenceImages: UploadedImage[]
): Promise<string[]> => {
  try {
      const ai = await getClient();

      // Use the first image as the primary visual anchor for the prompt context
      const primaryRef = referenceImages[0];
      const parts: any[] = [];
      
      if (primaryRef) {
          parts.push({
              inlineData: {
                  data: primaryRef.base64,
                  mimeType: primaryRef.mimeType
              }
          });
      }
      
      // We removed the hardcoded "Generate a photorealistic image" prefix.
      // We let the style.prompt dictate the output, while strictly enforcing facial similarity.
      parts.push({ 
          text: `Generate an image based on this specific description: "${style.prompt}". 
          CRITICAL INSTRUCTION: The person in the generated image must physically look like the person in the attached reference image (same facial features, structure, and identity). 
          Maintain the exact artistic style described.` 
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: parts },
        config: {
            imageConfig: {
                aspectRatio: "1:1",
                imageSize: "1K"
            }
        }
      });

      const generatedUrls: string[] = [];
      for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
              generatedUrls.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
          }
      }

      if (generatedUrls.length === 0) throw new Error("No image generated");
      return generatedUrls;

  } catch (error) {
      await handleApiError(error);
      return []; // Should not reach here
  }
};