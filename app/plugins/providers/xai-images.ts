import type { AssistantImages, ImagesModel } from "@earendil-works/pi-ai";

import { createImagesProvider } from "@earendil-works/pi-ai";
import { xaiProvider } from "@earendil-works/pi-ai/providers/xai";

import { imageRequest } from "./image-http.ts";

interface XaiImagesResponse {
  data?: { b64_json?: string; revised_prompt?: string }[];
}

export function xaiImagesProvider() {
  const models: ImagesModel<"xai-images">[] = [
    ["grok-imagine-image-2.0", "Grok Imagine Image 2.0"],
    ["grok-imagine-image-quality", "Grok Imagine Image Quality"],
  ].map(([id, name]) => ({
    id,
    name,
    api: "xai-images",
    provider: "xai",
    baseUrl: "https://api.x.ai/v1",
    input: ["text", "image"],
    output: ["image"],
    // This endpoint bills per image; token-rate estimates are unavailable.
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  }));
  return createImagesProvider({
    id: "xai",
    name: "xAI",
    auth: xaiProvider().auth,
    models,
    api: {
      async generateImages(model, context, options) {
        if (!options?.apiKey) {
          throw new Error("Connect xAI in Settings → Providers");
        }
        const prompt = context.input
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n");
        const images = context.input
          .filter((block) => block.type === "image")
          .map((block) => ({
            type: "image_url",
            url: `data:${block.mimeType};base64,${block.data}`,
          }));
        if (images.length > 4) {
          throw new Error("Use at most four reference images");
        }
        const response = await imageRequest<XaiImagesResponse>(
          model,
          images.length ? "images/edits" : "images/generations",
          {
            model: model.id,
            prompt,
            n: 1,
            response_format: "b64_json",
            ...(images.length === 1 ? { image: images[0] } : images.length ? { images } : {}),
          },
          options,
          { authorization: `Bearer ${options.apiKey}` },
        );
        const output: AssistantImages["output"] = [];
        if (!Array.isArray(response?.data)) {
          throw new Error("xAI returned no image data");
        }
        for (const item of response.data) {
          if (typeof item.b64_json !== "string" || !item.b64_json) {
            throw new Error("xAI returned an image without base64 data");
          }
          output.push({
            type: "image",
            mimeType: "image/jpeg",
            data: item.b64_json,
          });
          if (typeof item.revised_prompt === "string" && item.revised_prompt) {
            output.push({ type: "text", text: item.revised_prompt });
          }
        }
        return {
          api: model.api,
          provider: model.provider,
          model: model.id,
          output,
          stopReason: "stop",
          timestamp: Date.now(),
        };
      },
    },
  });
}
