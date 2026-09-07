import { definePlugin } from "../../kernel/plugin.ts";
import type { ToolDefinition, ToolRegistry } from "../../contracts/tools.ts";
export class Registry implements ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  register(tool: ToolDefinition) {
    if (this.tools.has(tool.name)) {
      throw new Error(`Duplicate tool: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    return () => {
      this.tools.delete(tool.name);
    };
  }
  list() {
    return [...this.tools.values()];
  }
  execute(name: string, args: Record<string, unknown>, signal: AbortSignal) {
    signal.throwIfAborted();
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return tool.execute(args, signal);
  }
}
export default definePlugin({
  id: "tool-registry",
  apiVersion: 1,
  provides: ["tools"],
  activate: (ctx) => ctx.provide("tools", new Registry()),
});
