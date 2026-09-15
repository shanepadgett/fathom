import type { ToolContext, ToolRegistry } from "../../sdk/mod.ts";

import { join } from "node:path";

import { atomicWrite } from "../../kernel/files.ts";

function typeOf(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "unknown";
  }
  const schema = value as Record<string, unknown>;
  if (Array.isArray(schema.enum)) {
    return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  }
  if (schema.type === "string") return "string";
  if (schema.type === "number" || schema.type === "integer") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "array") {
    return `Array<${typeOf((schema.items ?? {}) as Record<string, unknown>)}>`;
  }
  if (schema.type === "object") {
    const required = Array.isArray(schema.required) ? schema.required : [];
    return `{${
      Object.entries(
        (schema.properties ?? {}) as Record<string, Record<string, unknown>>,
      ).map(([key, value]) =>
        `${JSON.stringify(key)}${required.includes(key) ? "" : "?"}: ${
          typeOf(value)
        }`
      ).join("; ")
    }}`;
  }
  return "unknown";
}

export async function mcpBridge(
  directory: string,
  registry: ToolRegistry,
  context: ToolContext,
) {
  const token = crypto.randomUUID();
  const tools = registry.list(context.sessionId, true).filter((tool) =>
    tool.name.startsWith("mcp_")
  );
  const allowed = new Map(tools.map((tool) => [tool.name, tool]));
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen() {} },
    async (request) => {
      if (
        request.method !== "POST" ||
        request.headers.get("authorization") !== `Bearer ${token}`
      ) return new Response("Unauthorized", { status: 401 });
      try {
        const body = await request.text();
        if (body.length > 1_000_000) {
          return new Response("Too large", {
            status: 413,
          });
        }
        const { name, args } = JSON.parse(body);
        const tool = allowed.get(name);
        if (!tool) return new Response("Tool unavailable", { status: 404 });
        context.signal.throwIfAborted();
        const result = await tool.execute(args, context);
        return Response.json({ result: JSON.parse(result) });
      } catch (error) {
        return Response.json({
          error: error instanceof Error ? error.message : String(error),
        }, { status: 400 });
      }
    },
  );
  const address = server.addr as Deno.NetAddr;
  const groups = new Map<string, typeof tools>();
  for (const tool of tools) {
    const id = tool.tags?.find((tag) => tag !== "mcp") ?? "tools";
    const group = groups.get(id) ?? [];
    group.push(tool);
    groups.set(id, group);
  }
  const source =
    `async function invoke(name: string, args: unknown): Promise<unknown> {
    const response = await fetch(${
      JSON.stringify(`http://127.0.0.1:${address.port}`)
    }, {method: "POST", headers: {authorization: "Bearer " + Deno.env.get("FATHOM_MCP_TOKEN"), "content-type": "application/json"}, body: JSON.stringify({name,args})});
    const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "MCP call failed"); return result.result;
  }\n` + [...groups].map(([id, tools]) =>
      `export const ${id} = {${
        tools.map((tool) =>
          `${JSON.stringify(tool.name.slice(`mcp_${id}_`.length))}: (args: ${
            typeOf(tool.parameters)
          }) => invoke(${JSON.stringify(tool.name)}, args)`
        ).join(",\n")
      }};`
    ).join("\n");
  const module = join(directory, "mcp.ts"),
    config = join(directory, "deno.json");
  await atomicWrite(module, source);
  await atomicWrite(
    config,
    JSON.stringify({ imports: { "fathom:mcp": "./mcp.ts" } }),
  );
  return { config, token, close: () => server.shutdown() };
}
