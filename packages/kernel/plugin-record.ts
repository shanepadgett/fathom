import type { PluginDef, PluginStatus } from "@fathom/sdk";
import type { PluginScope } from "./scope.ts";

export interface PluginRecord {
  def?: PluginDef;
  status: PluginStatus;
  scope?: PluginScope;
  handoff?: unknown;
}
