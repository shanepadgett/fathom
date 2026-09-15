import type { AssistantImages, ImagesModel } from "@earendil-works/pi-ai";
import { createImagesProvider } from "@earendil-works/pi-ai";
import { googleProvider } from "@earendil-works/pi-ai/providers/google";
import { imageRequest } from "./image-http.ts";

interface GoogleImagesResponse {
  responseId?: string;
  promptFeedback?: { blockReason?: string };
  candidates?: {
    finishReason?: string;
    content?: {
      parts?: {
        text?: string;
        thought?: boolean;
        inlineData?: { mimeType?: string; data?: string };
      }[];
    };
  }[];
}

export function googleImagesProvider() {
  const models: ImagesModel<"google-images">[] = [
    ["gemini-2.5-flash-image", "Nano Banana (Gemini 2.5 Flash Image)"],
    ["gemini-3-pro-image", "Nano Banana Pro (Gemini 3 Pro Image)"],
    ["gemini-3.1-flash-image", "Nano Banana 2 (Gemini 3.1 Flash Image)"],
    [
      "gemini-3.1-flash-lite-image",
      "Nano Banana 2 Lite (Gemini 3.1 Flash Lite Image)",
    ],
  ].map(([id, name]) => ({
    id,
    name,
    api: "google-images",
    provider: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1",
    input: ["text", "image"],
    output: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  }));
  return createImagesProvider({
    id: "google",
    name: "Google",
    auth: googleProvider().auth,
    models,
    api: {
      async generateImages(model, context, options) {
        if (!options?.apiKey) {
          throw new Error("Connect Google in Settings → Providers");
        }
        const parts = context.input.map((block) =>
          block.type === "text"
            ? { text: block.text }
            : { inlineData: { mimeType: block.mimeType, data: block.data } }
        );
        const response = await imageRequest<GoogleImagesResponse>(
          model,
          `models/${encodeURIComponent(model.id)}:generateContent`,
          {
            contents: [{ role: "user", parts }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
          },
          options,
          { "x-goog-api-key": options.apiKey },
        );
        if (response?.promptFeedback?.blockReason) {
          throw new Error(
            `Google declined image generation: ${response.promptFeedback.blockReason}`,
          );
        }
        if (!Array.isArray(response?.candidates)) {
          throw new Error("Google returned no image candidates");
        }
        const output: AssistantImages["output"] = [];
        for (const candidate of response.candidates) {
          if (candidate.finishReason && candidate.finishReason !== "STOP") {
            throw new Error(
              `Google image generation did not complete: ${candidate.finishReason}`,
            );
          }
          for (const part of candidate.content?.parts ?? []) {
            if (part.thought) continue;
            if (typeof part.text === "string") {
              output.push({ type: "text", text: part.text });
            }
            if (part.inlineData) {
              const { mimeType, data } = part.inlineData;
              if (
                typeof mimeType !== "string" ||
                !mimeType.startsWith("image/") || typeof data !== "string" ||
                !data
              ) throw new Error("Google returned invalid image data");
              output.push({ type: "image", mimeType, data });
            }
          }
        }
        return {
          api: model.api,
          provider: model.provider,
          model: model.id,
          output,
          responseId: response.responseId,
          stopReason: "stop",
          timestamp: Date.now(),
        };
      },
    },
  });
}
