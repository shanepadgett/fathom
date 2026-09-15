import type { ImagesInputContent } from "@earendil-works/pi-ai";
import type {
  ImageGenerationService,
  ImageSelection,
} from "../../sdk/images.ts";

import { Buffer } from "node:buffer";
import { createImagesModels } from "@earendil-works/pi-ai";
import { openrouterImagesProvider } from "@earendil-works/pi-ai/providers/openrouter-images";
import { Type } from "typebox";

import { assertNewFile } from "../../kernel/files.ts";
import { definePlugin } from "../../sdk/mod.ts";
import { Credentials } from "./credentials.ts";

export function imagesPlugin(authPath: string) {
  return definePlugin({
    id: "fathom:images",
    apiVersion: 1,
    backend: {
      requires: ["storage", "media", "tools", "rpc", "workspace"],
      provides: ["images"],
      activate(ctx) {
        const storage = ctx.get("storage"), media = ctx.get("media");
        const models = createImagesModels({
          credentials: new Credentials(authPath),
        });
        models.setProvider(openrouterImagesProvider());
        const selection = () =>
          storage.setting<ImageSelection | null>("images.model", null);
        const selected = () => {
          const value = selection();
          return value
            ? models.getModel(value.provider, value.model)
            : undefined;
        };
        const service: ImageGenerationService = {
          models,
          async generate(sessionId, input, signal) {
            storage.getSession(sessionId);
            const model = selected();
            if (!model?.output.includes("image")) {
              throw new Error("Choose an image model in Settings → Providers");
            }
            if (!input.prompt.trim() || input.prompt.length > 20_000) {
              throw new Error("Image prompts must contain 1–20,000 characters");
            }
            if ((input.images?.length ?? 0) > 4) {
              throw new Error("Use at most four reference images");
            }
            if (input.destination !== undefined) {
              if (!input.destination.trim()) {
                throw new Error("Destination path must not be blank");
              }
              const destination = await ctx.get("workspace").resolve(
                input.destination,
                true,
              );
              await assertNewFile(destination);
            }
            signal?.throwIfAborted();
            const content: ImagesInputContent[] = [{
              type: "text",
              text: input.prompt,
            }];
            for (const id of input.images ?? []) {
              if (!model.input.includes("image")) {
                throw new Error(
                  "This image model does not accept reference images",
                );
              }
              const { asset, data } = await media.read(sessionId, id);
              if (!asset.mime.startsWith("image/")) {
                throw new Error("Reference assets must be images");
              }
              content.push({
                type: "image",
                mimeType: asset.mime,
                data: Buffer.from(data).toString("base64"),
              });
            }
            const started = Date.now();
            const result = await models.generateImages(model, {
              input: content,
            }, { signal });
            if (result.usage) {
              storage.recordUsage({
                id: crypto.randomUUID(),
                pluginId: "fathom:images",
                purpose: "image_generation",
                sessionId,
                provider: model.provider,
                model: model.id,
                usage: result.usage,
                durationMs: Date.now() - started,
                createdAt: Date.now(),
              });
            }
            if (result.stopReason !== "stop") {
              throw new Error(
                result.errorMessage || "Image generation did not complete",
              );
            }
            const outputs = result.output.filter((block) =>
              block.type === "image"
            );
            if (!outputs.length) {
              throw new Error("The provider returned no images");
            }
            const assets = [];
            for (const [index, output] of outputs.entries()) {
              if (output.data.length > 90_000_000) {
                throw new Error("Generated image exceeds the media limit");
              }
              const extension =
                output.mimeType.split("/")[1]?.replace("jpeg", "jpg") || "png";
              assets.push(
                await media.save(sessionId, {
                  name: `generated-${result.timestamp}-${
                    index + 1
                  }.${extension}`,
                  mime: output.mimeType,
                  data: new Uint8Array(Buffer.from(output.data, "base64")),
                }),
              );
            }
            let path: string | undefined;
            if (input.destination) {
              if (assets.length !== 1) {
                throw new Error(
                  "Multiple images were saved to the media cache; export each asset to its own path",
                );
              }
              path = (await media.materialize(
                sessionId,
                assets[0].id,
                input.destination,
              )).path;
            }
            return {
              assets,
              text: result.output.filter((block) => block.type === "text").map((
                block,
              ) => block.text).join("\n"),
              path,
            };
          },
        };
        ctx.provide("images", service);
        const disposers = [
          ctx.get("tools").register({
            name: "generate_image",
            deferred: true,
            available: () => selected()?.output.includes("image") ?? false,
            description:
              "Generate images using the configured image model. Saves image assets in the conversation with previews. Optional reference image IDs must belong to this branch; destination exports a single result to a new workspace file.",
            parameters: Type.Object({
              prompt: Type.String(),
              images: Type.Optional(Type.Array(Type.String(), { maxItems: 4 })),
              destination: Type.Optional(Type.String()),
            }),
            execute: async (args, input) =>
              JSON.stringify(
                await service.generate(
                  input.sessionId,
                  args as {
                    prompt: string;
                    images?: string[];
                    destination?: string;
                  },
                  input.signal,
                ),
              ),
          }),
          ctx.get("rpc").register("images.settings", async () => {
            const connected = new Set<string>();
            for (const provider of models.getProviders()) {
              if (await models.getAuth(provider.id)) connected.add(provider.id);
            }
            return {
              selected: selection(),
              models: models.getModels().filter((model) =>
                connected.has(model.provider)
              ).map(({ id, name, provider }) => ({ id, name, provider })),
            };
          }),
          ctx.get("rpc").register("images.select", async (params) => {
            if (params.model === null) {
              storage.setSetting("images.model", null);
              return {};
            }
            const model = models.getModel(
              String(params.provider),
              String(params.model),
            );
            if (
              !model?.output.includes("image") || !await models.getAuth(model)
            ) {
              throw new Error(
                "Connect a supported image provider and choose an available model",
              );
            }
            storage.setSetting("images.model", {
              provider: model.provider,
              model: model.id,
            });
            return {};
          }),
        ];
        ctx.effect(() => () => {
          for (const dispose of disposers) dispose();
          models.clearProviders();
        });
      },
    },
  });
}
