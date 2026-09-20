import { createSignal } from "solid-js";
import { CompositionSchema, decode, type PluginStatus } from "@fathom/sdk";
import type { BrowserClient } from "./client.ts";

export async function openBrowserComposition(client: BrowserClient) {
  let composition = decode(
    CompositionSchema,
    await client.request("/api/composition"),
  );

  const [slots, setSlots] = createSignal(composition.slots);

  return {
    slots,

    async save(statuses: PluginStatus[]) {
      const current = decode(
        CompositionSchema,
        await client.request("/api/composition"),
      );

      if (JSON.stringify(current.ui) !== JSON.stringify(composition.ui)) {
        composition = current;
        throw new Error(
          "UI composition changed in another window. Refresh and retry.",
        );
      }

      composition = current;

      composition = decode(
        CompositionSchema,
        await client.request("/api/composition", {
          ...composition,
          ui: Object.fromEntries(
            statuses.map((plugin) => [
              plugin.id,
              {
                enabled: plugin.desired.enabled,
                config: plugin.desired.config,
              },
            ]),
          ),
        }),
      );
    },

    async refresh() {
      composition = decode(
        CompositionSchema,
        await client.request("/api/composition"),
      );

      setSlots(composition.slots);
    },
  };
}
