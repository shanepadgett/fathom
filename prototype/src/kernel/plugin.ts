import type { Context } from "cordis";
import type { Services } from "../contracts/services.ts";
export interface PluginContext {
  /** Native Cordis context for more advanced extension needs. */
  cordis: Context;
  get<K extends keyof Services>(key: K): Services[K];
  provide<K extends keyof Services>(key: K, service: Services[K]): void;
  effect(setup: () => () => void | Promise<void>): void;
}
export interface HarnessPlugin {
  id: string;
  apiVersion: 1;
  provides?: string[];
  requires?: string[];
  activate(ctx: PluginContext): void | Promise<void>;
}
export function definePlugin(plugin: HarnessPlugin): HarnessPlugin {
  return plugin;
}
