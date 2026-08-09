import "server-only";
import { GoogleGenAI } from "@google/genai";
import { callExternalApi } from "@/lib/external-api";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// FR-6: fallback image generation, triggered only when no curated-library/
// cached/re-ranked candidate scores well (R1/R2 confidence threshold).
// Imagen (part of the same Google GenAI platform as Gemini) is the
// purpose-built model family for text-to-image generation.
export async function generateFallbackImage(prompt: string): Promise<Buffer> {
  const response = await callExternalApi(
    "gemini",
    () =>
      ai.models.generateImages({
        model: "imagen-4.0-generate-001",
        prompt: `Meme-style image for: ${prompt}`,
        config: { numberOfImages: 1 },
      }),
    { timeoutMs: 30_000 }
  );

  const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
  if (!imageBytes) {
    throw new Error("Gemini/Imagen did not return image data");
  }
  return Buffer.from(imageBytes, "base64");
}
