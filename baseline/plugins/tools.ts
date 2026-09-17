/** Tool registry. Consumers register; the agent calls. Schema-checks arguments before execute. */
import type { TSchema } from "typebox";

import type { PluginContext } from "../sdk.ts";

import { Service } from "cordis";
import { Value } from "typebox/value";

export interface ToolCycle {
  sessionId: string;
  signal: AbortSignal;
}

export interface Tool {
  name: string;
  description: string;
  parameters: TSchema;
  execute(args: Record<string, unknown>, cycle: ToolCycle): Promise<string>;
}

declare module "../sdk.ts" {
  interface Services {
    tools: Tools;
  }
}

export default class Tools extends Service {
  static provide = "tools" as const;

  private items = new Map<string, Tool>();

  constructor(ctx: PluginContext<never>) {
    super(ctx, "tools");
  }

  register(tool: Tool) {
    if (this.items.has(tool.name)) {
      throw new Error(`Duplicate tool: ${tool.name}`);
    }
    this.items.set(tool.name, tool);
    return () => this.items.delete(tool.name);
  }

  get(name: string) {
    return this.items.get(name);
  }

  list() {
    return [...this.items.values()];
  }

  async call(name: string, args: unknown, cycle: ToolCycle) {
    const tool = this.items.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    if (!Value.Check(tool.parameters, args)) {
      throw new Error("Tool arguments do not match its schema");
    }
    return tool.execute(args as Record<string, unknown>, cycle);
  }
}
