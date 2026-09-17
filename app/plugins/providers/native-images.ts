import { definePlugin } from "../../sdk/mod.ts";
import { googleImagesProvider } from "./google-images.ts";
import { openaiImagesProvider } from "./openai-images.ts";
import { xaiImagesProvider } from "./xai-images.ts";

export const nativeImages = definePlugin({
  id: "fathom:native-images",
  apiVersion: 1,
  backend: {
    requires: ["images"],
    activate(ctx) {
      const models = ctx.get("images").models;
      const providers = [xaiImagesProvider(), googleImagesProvider(), openaiImagesProvider()];
      for (const provider of providers) models.setProvider(provider);
      ctx.effect(() => () => {
        for (const provider of providers) {
          if (models.getProvider(provider.id) === provider) {
            models.deleteProvider(provider.id);
          }
        }
      });
    },
  },
});
