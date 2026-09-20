import type { ApiToken, PluginDef } from "@fathom/sdk";
import type { Kernel } from "@fathom/kernel";
import type { BrowserClient } from "./client.ts";

export function createApiAvailability(kernel: Kernel, client: BrowserClient) {
  const known = new Map<string, ApiToken>();
  const available = new Set<string>();

  return {
    register(definition: PluginDef) {
      for (const token of Object.values(definition.requires)) {
        if (token.kind === "service" && "operations" in token) {
          known.set(token.id, token as ApiToken);
        }
      }
    },

    async reconcile(ids: string[]) {
      for (const api of known.values()) {
        if (ids.includes(api.id) && !available.has(api.id)) {
          await kernel.setHostService(api, client.api(api));
          available.add(api.id);
        } else if (!ids.includes(api.id) && available.has(api.id)) {
          await kernel.setHostService(api, undefined);
          available.delete(api.id);
        }
      }
    },
  };
}
