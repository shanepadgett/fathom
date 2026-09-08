import type { Services } from "../contracts/services.ts";
import type { HarnessPlugin } from "./plugin.ts";

import { Context, type Fiber } from "cordis";

/** Validates composition upfront; Cordis owns activation effects and teardown. */
export class PluginHost {
  readonly context = new Context();
  private mounted: { plugin: HarnessPlugin; fiber: Fiber }[] = [];

  async mount(plugins: HarnessPlugin[]) {
    if (this.mounted.length) throw new Error("Host already mounted");
    const providers = new Map<string, string>();
    const ids = new Set<string>();
    for (const p of plugins) {
      if (p.apiVersion !== 1) {
        throw new Error(`Unsupported plugin API: ${p.id}`);
      }
      if (ids.has(p.id)) throw new Error(`Duplicate plugin: ${p.id}`);
      ids.add(p.id);
      for (const key of p.provides ?? []) {
        if (providers.has(key)) {
          throw new Error(`Duplicate service ${key}: ${providers.get(key)}, ${p.id}`);
        }
        providers.set(key, p.id);
      }
    }
    const pending = [...plugins];
    const ready = new Set<string>();
    const ordered: HarnessPlugin[] = [];
    while (pending.length) {
      const index = pending.findIndex((p) => (p.requires ?? []).every((k) => ready.has(k)));
      if (index < 0) {
        throw new Error(
          `Missing or cyclic dependencies: ${pending
            .map(
              (p) => `${p.id} needs ${(p.requires ?? []).filter((k) => !ready.has(k)).join(",")}`,
            )
            .join("; ")}`,
        );
      }
      const [p] = pending.splice(index, 1);
      ordered.push(p);
      for (const k of p.provides ?? []) ready.add(k);
    }
    try {
      for (const plugin of ordered) {
        const fiber = this.context.plugin({
          name: plugin.id,
          inject: (plugin.requires ?? []).map((key) => `fathom:${key}`),
          apply: async (ctx: Context) => {
            await plugin.activate({
              cordis: ctx,
              get: (key) => {
                if (!(plugin.requires ?? []).includes(key)) {
                  throw new Error(`${plugin.id} did not declare dependency ${key}`);
                }
                return ctx.get(`fathom:${key}`, true);
              },
              provide: (key, value) => {
                if (!(plugin.provides ?? []).includes(key)) {
                  throw new Error(`${plugin.id} did not declare service ${key}`);
                }
                ctx.provide(`fathom:${key}`, value);
              },
              effect: (setup) => {
                ctx.effect(setup);
              },
            });
            for (const key of plugin.provides ?? []) {
              if (!ctx.get(`fathom:${key}`, false)) {
                throw new Error(`${plugin.id} failed to provide ${key}`);
              }
            }
          },
        });
        this.mounted.push({ plugin, fiber });
        await fiber;
        if (fiber.state !== 2) {
          throw new Error(`Plugin failed to activate: ${plugin.id}`);
        }
      }
    } catch (error) {
      await this.dispose();
      throw error;
    }
  }

  get<K extends keyof Services>(key: K): Services[K] {
    const value = this.context.get(`fathom:${key}`);
    if (!value) throw new Error(`Service unavailable: ${key}`);
    return value;
  }
  describe() {
    return this.mounted.map(({ plugin, fiber }) => ({
      id: plugin.id,
      provides: plugin.provides ?? [],
      requires: plugin.requires ?? [],
      status: fiber.state === 2 ? "active" : "inactive",
    }));
  }
  async dispose() {
    for (const { fiber } of this.mounted.splice(0).reverse()) {
      await fiber.dispose();
    }
  }
}
