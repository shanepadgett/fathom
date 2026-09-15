import type { AssistantImages, ImagesModel } from "@earendil-works/pi-ai";

import { Buffer } from "node:buffer";
import { createImagesProvider } from "@earendil-works/pi-ai";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";

import { imageRequest } from "./image-http.ts";

interface OpenaiImagesResponse {
  data?: { b64_json?: string; revised_prompt?: string }[];
}

interface OpenaiImageResponse {
  id?: string;
  status?: string;
  error?: { message?: string };
  output?: {
    type: string;
    status?: string;
    result?: string;
    revised_prompt?: string;
    content?: { type: string; text?: string; refusal?: string }[];
  }[];
}

function appendImage(
  output: AssistantImages["output"],
  data: unknown,
  prompt?: string,
) {
  if (typeof data !== "string" || !data) {
    throw new Error("OpenAI returned an image without base64 data");
  }
  output.push({ type: "image", mimeType: "image/png", data });
  if (typeof prompt === "string" && prompt) {
    output.push({ type: "text", text: prompt });
  }
}

export function openaiImagesProvider() {
  const models: ImagesModel<"openai-images">[] = [
    ["gpt-image-2", "GPT Image 2"],
    ["gpt-image-2-responses", "GPT Image 2 (Responses · Luna)"],
  ].map(([id, name]) => ({
    id,
    name,
    api: "openai-images",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    input: ["text", "image"],
    output: ["text", "image"],
    // Image/text token rates differ; do not report an incomplete cost estimate.
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  }));
  return createImagesProvider({
    id: "openai",
    name: "OpenAI",
    auth: openaiProvider().auth,
    models,
    api: {
      async generateImages(model, context, options) {
        if (!options?.apiKey) {
          throw new Error("Connect an OpenAI API key in Settings → Providers");
        }
        const images = context.input.filter((block) => block.type === "image");
        if (images.length > 4) {
          throw new Error("Use at most four reference images");
        }
        for (const image of images) {
          if (
            !["image/png", "image/jpeg", "image/webp"].includes(image.mimeType)
          ) {
            throw new Error(
              "OpenAI image references must be PNG, JPEG or WebP",
            );
          }
        }
        const headers = { authorization: `Bearer ${options.apiKey}` };
        const output: AssistantImages["output"] = [];
        let responseId: string | undefined;
        if (model.id === "gpt-image-2-responses") {
          const response = await imageRequest<OpenaiImageResponse>(
            model,
            "responses",
            {
              model: "gpt-5.6-luna",
              store: false,
              input: [{
                role: "user",
                content: context.input.map((block) =>
                  block.type === "text"
                    ? { type: "input_text", text: block.text }
                    : {
                      type: "input_image",
                      image_url: `data:${block.mimeType};base64,${block.data}`,
                      detail: "auto",
                    }
                ),
              }],
              tools: [{
                type: "image_generation",
                model: "gpt-image-2",
                output_format: "png",
              }],
              tool_choice: "required",
              parallel_tool_calls: false,
            },
            options,
            headers,
          );
          if (
            response?.status !== "completed" || !Array.isArray(response.output)
          ) {
            throw new Error(
              response?.error?.message ||
                "OpenAI image response did not complete",
            );
          }
          responseId = response.id;
          for (const item of response.output) {
            if (item.type === "image_generation_call") {
              if (item.status !== "completed") {
                throw new Error("OpenAI image generation did not complete");
              }
              appendImage(output, item.result, item.revised_prompt);
            } else if (item.type === "message") {
              for (const content of item.content ?? []) {
                if (content.type === "refusal") {
                  throw new Error(
                    content.refusal || "OpenAI declined image generation",
                  );
                }
                if (
                  content.type === "output_text" &&
                  typeof content.text === "string"
                ) {
                  output.push({ type: "text", text: content.text });
                }
              }
            }
          }
        } else {
          const prompt = context.input.filter((block) => block.type === "text")
            .map((block) => block.text).join("\n");
          let payload: unknown = {
            model: "gpt-image-2",
            prompt,
            n: 1,
            output_format: "png",
          };
          if (images.length) {
            const form = new FormData();
            for (
              const [key, value] of Object.entries(
                payload as Record<string, unknown>,
              )
            ) form.set(key, String(value));
            for (const [index, image] of images.entries()) {
              const bytes = new Uint8Array(Buffer.from(image.data, "base64"));
              const extension = image.mimeType.split("/")[1];
              form.append(
                "image[]",
                new Blob([bytes], { type: image.mimeType }),
                `reference-${index + 1}.${extension}`,
              );
            }
            payload = form;
          }
          const response = await imageRequest<OpenaiImagesResponse>(
            model,
            images.length ? "images/edits" : "images/generations",
            payload,
            options,
            headers,
          );
          if (!Array.isArray(response?.data)) {
            throw new Error("OpenAI returned no image data");
          }
          for (const item of response.data) {
            appendImage(output, item.b64_json, item.revised_prompt);
          }
        }
        if (!output.some((block) => block.type === "image")) {
          throw new Error("OpenAI returned no images");
        }
        return {
          api: model.api,
          provider: model.provider,
          model: model.id,
          output,
          responseId,
          stopReason: "stop",
          timestamp: Date.now(),
        };
      },
    },
  });
}
