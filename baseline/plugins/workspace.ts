/** Workspace root, data dir, and path jail. Everything else that touches disk injects this. */
import type { PluginContext } from "../sdk.ts";

import { isAbsolute, join, relative, resolve } from "@std/path";
import { Service } from "cordis";

export interface WorkspaceConfig {
  root: string;
  home: string;
}

declare module "../sdk.ts" {
  interface Services {
    workspace: Workspace;
  }
}

export default class Workspace extends Service {
  static provide = "workspace" as const;

  readonly root: string;
  readonly home: string;
  readonly dataDir: string;

  constructor(ctx: PluginContext<never>, config: WorkspaceConfig) {
    super(ctx, "workspace");
    this.root = resolve(config.root);
    this.home = resolve(config.home);
    this.dataDir = join(this.home, "data");
  }

  /** Resolve a workspace-relative path and refuse anything outside the root. */
  resolve(path: string) {
    const full = resolve(this.root, path);
    const inside = relative(this.root, full);
    if (inside.startsWith("..") || isAbsolute(inside)) {
      throw new Error("Path is outside the workspace");
    }
    return full;
  }
}
