import { McpServer } from "npm:@modelcontextprotocol/server@2.0.0";
import { StdioServerTransport } from "npm:@modelcontextprotocol/server@2.0.0/stdio";
import * as z from "npm:zod@4.5.4";

export function makeServer() {
  const server = new McpServer({ name: "fathom-fixture", version: "1.0.0" });
  server.registerTool("greet", {
    description:
      "Local integration fixture; returns a greeting without side effects.",
    inputSchema: z.object({ name: z.string() }),
  }, ({ name }) => ({ content: [{ type: "text", text: `Hello, ${name}!` }] }));
  return server;
}
if (import.meta.main) await makeServer().connect(new StdioServerTransport());
