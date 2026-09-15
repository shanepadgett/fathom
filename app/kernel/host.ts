import type { Fiber } from "cordis";

import type { FathomPlugin, Services } from "../sdk/mod.ts";

import { Context } from "cordis";

/** Validate the dependency graph without activating plugin effects. */
export function orderPlugins(plugins: FathomPlugin[]) {
  const ids = new Set<string>();
  const providers = new Map<string, string>();
  for (const plugin of plugins) {
    if (!plugin.id || plugin.apiVersion !== 1) {
      throw new Error("Invalid plugin manifest or API version");
    }
    if (ids.has(plugin.id)) throw new Error(`Duplicate plugin: ${plugin.id}`);
    ids.add(plugin.id);
    for (const key of plugin.backend?.provides ?? []) {
      if (providers.has(key)) {
        throw new Error(
          `Service ${key} supplied by both ${
            providers.get(key)
          } and ${plugin.id}; disable one provider`,
        );
      }
      providers.set(key, plugin.id);
    }
  }
  const pending = [...plugins];
  const available = new Set<string>();
  const ordered: FathomPlugin[] = [];
  while (pending.length) {
    const index = pending.findIndex((p) =>
      (p.backend?.requires ?? []).every((key) => available.has(key))
    );
    if (index === -1) {
      throw new Error(
        `Missing or cyclic dependencies: ${
          pending.map((p) =>
            `${p.id} requires ${
              (p.backend?.requires ?? []).filter((k) => !available.has(k))
                .join(
                  ", ",
                )
            }`
          ).join("; ")
        }`,
      );
    }
    const [plugin] = pending.splice(index, 1);
    ordered.push(plugin);
    for (const key of plugin.backend?.provides ?? []) available.add(key);
  }
  return ordered;
}

/** Composition policy stays here; Cordis owns all plugin effects and services. */
export class PluginHost {
  readonly context = new Context();
  private mounted: { plugin: FathomPlugin; fiber: Fiber }[] = [];

  async mount(plugins: FathomPlugin[]) {
    if (this.mounted.length) throw new Error("Environment is already mounted");
    const ordered = orderPlugins(plugins);
    try {
      for (const plugin of ordered) {
        const backend = plugin.backend;
        const fiber = this.context.plugin({
          name: plugin.id,
          inject: (backend?.requires ?? []).map((key) => `fathom:${key}`),
          apply: async (cordis: Context) => {
            await backend?.activate({
              cordis,
              get(key) {
                if (!backend.requires?.includes(key)) {
                  throw new Error(
                    `${plugin.id} must declare dependency ${key}`,
                  );
                }
                return cordis.get(`fathom:${key}`, true);
              },
              provide(key, service) {
                if (!backend.provides?.includes(key)) {
                  throw new Error(`${plugin.id} must declare provision ${key}`);
                }
                cordis.provide(`fathom:${key}`, service);
              },
              effect: (setup) => {
                cordis.effect(setup);
              },
            });
            for (const key of backend?.provides ?? []) {
              if (cordis.get(`fathom:${key}`, false) === undefined) {
                throw new Error(`${plugin.id} did not provide ${key}`);
              }
            }
          },
        });
        this.mounted.push({ plugin, fiber });
        await fiber;
        if (fiber.state !== 2) {
          throw new Error(`Failed to activate ${plugin.id}`);
        }
      }
    } catch (error) {
      await this.dispose();
      throw error;
    }
  }

  get<K extends keyof Services>(key: K): Services[K] {
    return this.context.get(`fathom:${key}`, true);
  }

  describe() {
    return this.mounted.map(({ plugin, fiber }) => ({
      id: plugin.id,
      requires: plugin.backend?.requires ?? [],
      provides: plugin.backend?.provides ?? [],
      status: fiber.state === 2 ? "active" : "inactive",
    }));
  }

  async dispose() {
    const failures: unknown[] = [];
    for (const { fiber } of this.mounted.splice(0).reverse()) {
      try {
        await fiber.dispose();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) {
      throw new AggregateError(failures, "Plugin cleanup failed");
    }
  }
}
