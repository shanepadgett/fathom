import { createProvider, envApiKeyAuth } from "npm:@earendil-works/pi-ai@0.85.1";
import { openAICompletionsApi } from "npm:@earendil-works/pi-ai@0.85.1/api/openai-completions.lazy";

export default {
  id: "example:custom-gateway",
  apiVersion: 1,
  backend: {
    requires: ["model"],
    activate(ctx) {
      const baseUrl = Deno.env.get("FATHOM_GATEWAY_URL");
      const modelId = Deno.env.get("FATHOM_GATEWAY_MODEL");
      if (!baseUrl || !modelId) {
        throw new Error(
          "Set FATHOM_GATEWAY_URL and FATHOM_GATEWAY_MODEL before loading example:custom-gateway.",
        );
      }
      const url = new URL(baseUrl);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        throw new Error("Use an HTTP(S) gateway URL without embedded credentials.");
      }
      const models = ctx.get("model").models;
      const id = "example-gateway";
      if (models.getProvider(id)) {
        throw new Error(`Provider already registered: ${id}`);
      }
      const provider = createProvider({
        id,
        name: "Example gateway",
        baseUrl: url.href,
        auth: {
          apiKey: envApiKeyAuth("Gateway API key", ["FATHOM_GATEWAY_API_KEY"]),
        },
        api: openAICompletionsApi(),
        models: [
          {
            id: modelId,
            name: modelId,
            provider: id,
            api: "openai-completions",
            baseUrl: url.href,
            reasoning: false,
            input: ["text"],
            contextWindow: 8192,
            maxTokens: 2048,
            // Replace these example limits and prices with the gateway's actual metadata.
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          },
        ],
      });
      ctx.effect(() => {
        models.setProvider(provider);
        return () => {
          if (models.getProvider(id) === provider) models.deleteProvider(id);
        };
      });
    },
  },
};
