/** UI slot registry. The header only shows surfaces that registered. Duplicate ids fail at boot. */
import type { PluginContext } from "../sdk.ts";
import type { Surface, SurfaceId } from "../types.ts";

import { Service } from "cordis";

const order: SurfaceId[] = ["editor", "agent", "chat"];

declare module "../sdk.ts" {
  interface Services {
    surfaces: Surfaces;
  }
}

export default class Surfaces extends Service {
  static provide = "surfaces" as const;

  private items = new Map<SurfaceId, Surface>();

  constructor(ctx: PluginContext<never>) {
    super(ctx, "surfaces");
  }

  register(surface: Surface) {
    if (this.items.has(surface.id)) {
      throw new Error(`Duplicate surface: ${surface.id}`);
    }
    this.items.set(surface.id, surface);
    return () => this.items.delete(surface.id);
  }

  list(): Surface[] {
    return order.flatMap((id) => {
      const surface = this.items.get(id);
      return surface ? [surface] : [];
    });
  }
}
