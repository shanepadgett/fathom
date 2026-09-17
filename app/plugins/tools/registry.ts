import type { ToolDefinition, ToolRegistry } from "../../sdk/mod.ts";

import { DatabaseSync } from "node:sqlite";

import { Type } from "typebox";

import { definePlugin } from "../../sdk/mod.ts";

export default definePlugin({
  id: "fathom:tools",
  apiVersion: 1,
  backend: {
    requires: ["storage"],
    provides: ["tools"],
    activate(ctx) {
      const storage = ctx.get("storage");
      const tools = new Map<string, ToolDefinition>();
      const index = new DatabaseSync(":memory:");
      index.exec("CREATE VIRTUAL TABLE tool_index USING fts5(name, description, tags)");
      const activated = new Map<string, Set<string>>();
      const allowed = (sessionId: string, tool: ToolDefinition) => {
        if (tool.available && !tool.available(sessionId)) return false;
        const policy = storage.getSession(sessionId).toolPolicy;
        if (policy === "read-only") return tool.readOnly === true;
        return policy !== "no-terminal" || !["bash", "pty", "script"].includes(tool.name);
      };
      const registry: ToolRegistry = {
        register(tool) {
          if (!/^[a-zA-Z][a-zA-Z0-9_]{0,127}$/.test(tool.name))
            throw new Error("Invalid tool name");
          if (tools.has(tool.name)) {
            throw new Error(`Duplicate tool: ${tool.name}`);
          }
          tools.set(tool.name, tool);
          index
            .prepare("INSERT INTO tool_index(name, description, tags) VALUES (?,?,?)")
            .run(tool.name, tool.description, (tool.tags ?? []).join(" "));
          return () => {
            tools.delete(tool.name);
            index.prepare("DELETE FROM tool_index WHERE name=?").run(tool.name);
          };
        },
        get: (name) => tools.get(name),
        list: (sessionId, includeDeferred = false) =>
          [...tools.values()].filter(
            (tool) =>
              allowed(sessionId, tool) &&
              (includeDeferred || !tool.deferred || activated.get(sessionId)?.has(tool.name)),
          ),
        search(sessionId, query) {
          const words = query.toLowerCase().split(/\W+/).filter(Boolean);
          if (!words.length) return [];
          const rows = index
            .prepare(
              "SELECT name FROM tool_index WHERE tool_index MATCH ? ORDER BY bm25(tool_index, 3, 1, 1) LIMIT 100",
            )
            .all(words.map((word) => `"${word}"*`).join(" OR "));
          const matches = rows
            .map((row) => tools.get(String(row.name))!)
            .filter((tool) => allowed(sessionId, tool))
            .slice(0, 8);
          const set = activated.get(sessionId) ?? new Set<string>();
          for (const tool of matches) set.add(tool.name);
          activated.set(sessionId, set);
          return matches;
        },
      };
      registry.register({
        name: "search_tools",
        description:
          "Find and activate additional tools by capability. Search before using a deferred tool.",
        parameters: Type.Object({ query: Type.String() }),
        readOnly: true,
        execute: (args, context) =>
          Promise.resolve(
            JSON.stringify(
              registry
                .search(context.sessionId, String(args.query))
                .map(({ name, description, parameters }) => ({ name, description, parameters })),
            ),
          ),
      });
      ctx.provide("tools", registry);
      ctx.effect(() => () => index.close());
    },
  },
});
