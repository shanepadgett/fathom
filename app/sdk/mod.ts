import type { Context } from "cordis";

import type { FrontendPlugin } from "./frontend.ts";
import type { Services } from "./services.ts";

export type * from "./session.ts";
export type * from "./services.ts";
export type * from "./frontend.ts";
export type * from "./ui-components.ts";
export type * from "./hooks.ts";
export type * from "./git.ts";
export type * from "./editor.ts";
export type * from "./auth.ts";
export type * from "./models.ts";
export type * from "./media.ts";
export type * from "./browser.ts";
export type * from "./dev-servers.ts";
export type * from "./terminal.ts";
export type * from "./layout.ts";
export type * from "./icons.ts";
export type * from "./feedback.ts";
export type * from "./images.ts";
export type * from "./resources.ts";
export { messageLink, parseMessageLink } from "./message-link.ts";
export type { MessageTarget } from "./message-link.ts";

export interface PluginContext {
  cordis: Context;
  get<K extends keyof Services>(key: K): Services[K];
  provide<K extends keyof Services>(key: K, service: Services[K]): void;
  effect(setup: () => () => void | Promise<void>): void;
}

export interface BackendPlugin {
  requires?: (keyof Services)[];
  provides?: (keyof Services)[];
  activate(ctx: PluginContext): void | Promise<void>;
}

export interface FathomPlugin {
  id: string;
  apiVersion: 1;
  backend?: BackendPlugin;
  /** Browser module relative to this manifest, or a browser-safe inline contribution. */
  frontend?: string | FrontendPlugin;
  skills?: string[];
}

export function definePlugin(plugin: FathomPlugin): FathomPlugin {
  return plugin;
}
export type { SnapshotPrunePlan, SnapshotService } from "./snapshots.ts";
export type { Artifact, ArtifactInput, ArtifactService } from "./artifacts.ts";
export type { ArtifactFeedback } from "./artifact-feedback.ts";
