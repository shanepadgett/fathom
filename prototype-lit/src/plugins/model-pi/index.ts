import { cleanupSessionResources, createModels, type TSchema } from "@earendil-works/pi-ai";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";

import { definePlugin } from "../../kernel/plugin.ts";
import { PiCredentialStore } from "./credentials.ts";
import { toPiMessages } from "./messages.ts";
export function piPlugin(authPath: string, modelId: string) {
  return definePlugin({
    id: "model-pi",
    apiVersion: 1,
    provides: ["model"],
    activate(ctx) {
      const models = createModels({
        credentials: new PiCredentialStore(authPath),
      });
      models.setProvider(openaiCodexProvider());
      const model = models.getModel("openai-codex", modelId);
      if (!model) {
        throw new Error(
          `Unknown Codex model ${modelId}. Available: ${models
            .getModels("openai-codex")
            .map((m) => m.id)
            .join(", ")}`,
        );
      }
      ctx.provide("model", {
        info: { provider: model.provider, id: model.id },
        async respond(input) {
          const stream = models.streamSimple(
            model,
            {
              systemPrompt: input.system,
              messages: toPiMessages(input.messages),
              tools: input.tools.map((t) => ({
                ...t,
                parameters: t.parameters as TSchema,
              })),
            },
            {
              signal: input.signal,
              reasoning: "low",
              maxTokens: 4096,
              transport: "sse",
            },
          );
          for await (const event of stream) {
            if (event.type === "text_delta") input.onText(event.delta);
          }
          const message = await stream.result();
          input.signal.throwIfAborted();
          if (message.stopReason === "error" || message.stopReason === "aborted") {
            throw new Error(message.errorMessage ?? `Model ${message.stopReason}`);
          }
          return {
            text: message.content
              .filter((c) => c.type === "text")
              .map((c) => c.text)
              .join(""),
            calls: message.content
              .filter((c) => c.type === "toolCall")
              .map((c) => ({ id: c.id, name: c.name, arguments: c.arguments })),
            stop:
              message.stopReason === "toolUse"
                ? "tools"
                : message.stopReason === "length"
                  ? "length"
                  : "done",
            continuation: { adapter: "pi-ai", value: message },
          };
        },
      });
      ctx.effect(() => () => {
        cleanupSessionResources();
        models.clearProviders();
      });
    },
  });
}
