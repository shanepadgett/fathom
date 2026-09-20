import type { PluginDef } from "@fathom/sdk";

export interface Loader {
  load(source: string, gen: number): Promise<{ default: PluginDef }>;
  activate?(source: string, def: PluginDef): Promise<() => void>;
  retain?(definitions: PluginDef[]): Promise<void>;
}
