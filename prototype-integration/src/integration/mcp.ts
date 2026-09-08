import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

export class McpService {
  private client?: Client;
  private http?: StreamableHTTPClientTransport;
  tools: {
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  }[] = [];
  async connect(options: { command?: string; args?: string[]; url?: string }) {
    await this.dispose();
    const client = new Client({ name: "fathom-prototype", version: "0.1.0" });
    this.client = client;
    const transport = options.url
      ? (this.http = new StreamableHTTPClientTransport(new URL(options.url)))
      : new StdioClientTransport({
          command: options.command ?? "deno",
          args: options.args ?? [],
        });
    try {
      await client.connect(transport);
      let cursor: string | undefined;
      do {
        const page = await client.listTools({ cursor });
        this.tools.push(...page.tools);
        cursor = page.nextCursor;
      } while (cursor);
    } catch (error) {
      await this.dispose();
      throw error;
    }
    return this.tools;
  }
  async call(name: string, args: Record<string, unknown>, signal: AbortSignal) {
    if (!this.client) throw new Error("Connect an MCP server first");
    return await this.client.callTool({ name, arguments: args }, { signal });
  }
  async dispose() {
    try {
      await this.http?.terminateSession();
    } finally {
      await this.client?.close();
      this.client = undefined;
      this.http = undefined;
      this.tools = [];
    }
  }
}
