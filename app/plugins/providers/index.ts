import type { ModelService } from "../../sdk/mod.ts";

import { calculateCost, createModels } from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import { googleProvider } from "@earendil-works/pi-ai/providers/google";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";
import { xaiProvider } from "@earendil-works/pi-ai/providers/xai";
import { Value } from "typebox/value";

import { definePlugin } from "../../sdk/mod.ts";
import { Credentials } from "./credentials.ts";

export function providersPlugin(authPath: string) {
  return definePlugin({
    id: "fathom:providers",
    apiVersion: 1,
    backend: {
      requires: ["storage"],
      provides: ["model"],
      activate(ctx) {
        const storage = ctx.get("storage");
        const models = createModels({ credentials: new Credentials(authPath) });
        for (
          const factory of [
            openaiCodexProvider,
            anthropicProvider,
            openaiProvider,
            googleProvider,
            openrouterProvider,
            xaiProvider,
          ]
        ) models.setProvider(factory());
        const service: ModelService = {
          models,
          async select(sessionId) {
            const session = sessionId
              ? storage.getSession(sessionId)
              : undefined;
            const provider = session?.provider ||
              storage.setting("provider", "");
            const id = session?.model || storage.setting("model", "");
            const available = await models.getAvailable(provider || undefined);
            const model = available.find((model) => model.id === id) ??
              (!id
                ? available.find((model) => model.id === "gpt-6-astra") ??
                  available[0]
                : undefined);
            if (!model) {
              throw new Error(
                "Connect a provider and choose an available model in Settings → Providers",
              );
            }
            return model;
          },
          async complete(input) {
            const model = input.model ??
              await service.select(input.attribution.sessionId);
            const start = Date.now();
            const context = {
              systemPrompt: input.systemPrompt,
              messages: input.messages,
              tools: input.tools,
            };
            if (input.schema) {
              context.tools = [{
                name: "structured_result",
                description: "Return the requested structured result",
                parameters: input.schema,
              }];
            }
            const result = await models.completeSimple(
              model,
              context,
              input.options,
            );
            calculateCost(model, result.usage);
            storage.recordUsage({
              ...input.attribution,
              id: crypto.randomUUID(),
              provider: model.provider,
              model: model.id,
              usage: result.usage,
              durationMs: Date.now() - start,
              createdAt: Date.now(),
            });
            if (
              result.stopReason === "error" || result.stopReason === "aborted"
            ) throw new Error(result.errorMessage ?? "Provider request failed");
            if (input.schema) {
              const call = result.content.find((block) =>
                block.type === "toolCall" && block.name === "structured_result"
              );
              if (
                !call || call.type !== "toolCall" ||
                !Value.Check(input.schema, call.arguments)
              ) {
                throw new Error(
                  "Provider did not return a valid structured result",
                );
              }
            }
            return result;
          },
        };
        ctx.provide("model", service);
        ctx.effect(() => () => {
          models.clearProviders();
        });
      },
    },
  });
}
