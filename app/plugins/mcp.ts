import type { TSchema } from "@earendil-works/pi-ai";

import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

import { definePlugin } from "../sdk/mod.ts";

interface ServerConfig {
  id: string;
  command?: string;
  args?: string[];
  url?: string;
}

export default definePlugin({
  id: "fathom:mcp",
  apiVersion: 1,
  backend: {
    requires: ["tools", "rpc", "storage", "workspace", "events"],
    async activate(ctx) {
      const tools = ctx.get("tools"),
        rpc = ctx.get("rpc"),
        storage = ctx.get("storage"),
        workspace = ctx.get("workspace"),
        events = ctx.get("events");
      const servers = new Map<
        string,
        {
          client: Client;
          config: ServerConfig;
          disposeTools: (() => void)[];
          count: number;
        }
      >();
      const failures = new Map<string, string>();
      const connecting = new Set<string>();
      const disconnect = async (id: string) => {
        const server = servers.get(id);
        if (!server) return;
        for (const dispose of server.disposeTools) dispose();
        try {
          await server.client.close();
        } finally {
          servers.delete(id);
        }
      };
      const connect = async (config: ServerConfig) => {
        if (!/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(config.id)) {
          throw new Error(
            "MCP server ID must use letters, numbers and underscores",
          );
        }
        if (
          servers.has(config.id) || connecting.has(config.id)
        ) throw new Error("Server is already connected or connecting");
        if (
          config.url &&
          !["http:", "https:"].includes(new URL(config.url).protocol)
        ) throw new Error("Use an HTTP or HTTPS MCP endpoint");
        if (!config.url && !config.command?.trim()) {
          throw new Error(
            "Enter the local MCP executable",
          );
        }
        const client = new Client({ name: "fathom", version: "0.1.0" });
        const transport = config.url
          ? new StreamableHTTPClientTransport(new URL(config.url))
          : new StdioClientTransport({
            command: config.command ?? "deno",
            args: config.args ?? [],
            cwd: workspace.root,
          });
        const registered: (() => void)[] = [];
        connecting.add(config.id);
        try {
          await client.connect(transport);
          let cursor: string | undefined, count = 0;
          do {
            const page = await client.listTools({ cursor });
            for (const tool of page.tools) {
              const name = `mcp_${config.id}_${
                tool.name.replace(/[^a-zA-Z0-9_]/g, "_")
              }`;
              registered.push(
                tools.register({
                  name,
                  description: tool.description ?? `${config.id}: ${tool.name}`,
                  parameters: tool.inputSchema as TSchema,
                  deferred: true,
                  tags: [config.id, "mcp"],
                  execute: async (args, context) => {
                    const result = await client.callTool({
                      name: tool.name,
                      arguments: args,
                    }, { signal: context.signal });
                    if (result.isError) {
                      throw new Error(JSON.stringify(result));
                    }
                    return JSON.stringify(result);
                  },
                }),
              );
              count++;
            }
            cursor = page.nextCursor;
          } while (cursor);
          servers.set(config.id, {
            client,
            config,
            disposeTools: registered,
            count,
          });
          failures.delete(config.id);
        } catch (error) {
          for (const dispose of registered) dispose();
          await client.close();
          throw error;
        } finally {
          connecting.delete(config.id);
        }
        events.publish({ type: "mcp" });
      };
      const disposers = [
        rpc.register("mcp.list", () =>
          [...servers.values()].map((server) => ({
            ...server.config,
            count: server.count,
            status: "connected",
          })).concat(
            [...failures].map(([id, error]) => ({
              id,
              count: 0,
              status: error,
            })),
          )),
        rpc.register("mcp.connect", async (params) => {
          const config: ServerConfig = {
            id: String(params.id),
            command: params.command ? String(params.command) : undefined,
            args: Array.isArray(params.args) ? params.args.map(String) : [],
            url: params.url ? String(params.url) : undefined,
          };
          await connect(config);
          const saved = storage.setting<ServerConfig[]>("mcp.servers", [])
            .filter((server) => server.id !== config.id);
          storage.setSetting("mcp.servers", [...saved, config]);
          return {};
        }),
        rpc.register("mcp.disconnect", async (params) => {
          const id = String(params.id);
          await disconnect(id);
          failures.delete(id);
          storage.setSetting(
            "mcp.servers",
            storage.setting<ServerConfig[]>("mcp.servers", []).filter(
              (server) => server.id !== id,
            ),
          );
          events.publish({ type: "mcp" });
          return {};
        }),
      ];
      if (workspace.trusted()) {
        for (
          const config of storage.setting<ServerConfig[]>("mcp.servers", [])
        ) {
          try {
            await connect(config);
          } catch (error) {
            failures.set(
              config.id,
              error instanceof Error ? error.message : String(error),
            );
          }
        }
      }
      ctx.effect(() => async () => {
        for (const dispose of disposers) dispose();
        await Promise.allSettled([...servers.keys()].map(disconnect));
      });
    },
  },
});
