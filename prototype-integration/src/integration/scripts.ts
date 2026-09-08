import type { Approvals } from "./approvals.ts";
import type { McpService } from "./mcp.ts";

import { join } from "node:path";

import { runProcess } from "../plugins/tools/process.ts";

export class Scripts {
  private files = new Map<string, { path: string; runtime: string }>();
  constructor(
    private root: string,
    private scratch: string,
    private mcp: McpService,
    private approvals: Approvals,
  ) {}
  async run(args: Record<string, unknown>, signal: AbortSignal) {
    const runtime = String(args.runtime ?? "deno");
    if (!["deno", "node", "python3", "bash"].includes(runtime)) {
      throw new Error("Choose deno, node, python3, or bash");
    }
    let id = String(args.scriptId ?? "");
    let file = this.files.get(id);
    let code: string;
    if (file) {
      code = await Deno.readTextFile(file.path);
      const oldText = String(args.oldText ?? "");
      if (!oldText || code.split(oldText).length !== 2) {
        throw new Error("Patch must match exactly once");
      }
      code = code.replace(oldText, String(args.newText ?? ""));
    } else {
      if (id) throw new Error("Unknown scriptId");
      if (typeof args.code !== "string") throw new Error("code is required");
      code = args.code;
      id = crypto.randomUUID();
      file = {
        runtime,
        path: join(
          this.scratch,
          id,
          `script.${
            runtime === "python3"
              ? "py"
              : runtime === "bash"
                ? "sh"
                : runtime === "node"
                  ? "mjs"
                  : "ts"
          }`,
        ),
      };
    }
    await this.approvals.request(
      `Run ${file.runtime} script with your user access:\n\n${code}`,
      signal,
    );
    const dir = join(this.scratch, id);
    await Deno.mkdir(dir, { recursive: true });
    await Deno.writeTextFile(file.path, code);
    this.files.set(id, file);
    const token = crypto.randomUUID();
    const lifecycle = new AbortController();
    const executionSignal = AbortSignal.any([signal, lifecycle.signal]);
    const bridge = Deno.serve(
      { hostname: "127.0.0.1", port: 0, onListen() {} },
      async (request) => {
        if (request.method !== "POST" || request.headers.get("authorization") !== `Bearer ${token}`)
          return new Response("Denied", { status: 403 });
        try {
          const { name, args } = await request.json();
          await this.approvals.request(
            `MCP tool ${name}\n${JSON.stringify(args, null, 2)}`,
            executionSignal,
          );
          return Response.json(await this.mcp.call(name, args, executionSignal));
        } catch (error) {
          return Response.json({ error: String(error) }, { status: 400 });
        }
      },
    );
    const facade = `export const mcp = new Proxy({} as Record<string, (args: Record<string, unknown>) => Promise<unknown>>, { get: (_, name: string) => async (args: Record<string, unknown>) => {
      const response = await fetch("http://127.0.0.1:${bridge.addr.port}", {method:"POST",headers:{authorization:"Bearer ${token}","content-type":"application/json"},body:JSON.stringify({name,args})});
      const result = await response.json(); if (!response.ok) throw new Error(JSON.stringify(result)); return result;
    }});\n`;
    await Deno.writeTextFile(join(dir, "mcp.ts"), facade);
    await Deno.writeTextFile(
      join(dir, "deno.json"),
      JSON.stringify({ imports: { "fathom:mcp": "./mcp.ts" } }),
    );
    try {
      const command =
        file.runtime === "deno" ? (Deno.env.get("FATHOM_DENO") ?? "deno") : file.runtime;
      const argv =
        file.runtime === "deno"
          ? ["run", "-A", "--config", join(dir, "deno.json"), file.path]
          : [file.path];
      return `scriptId=${id}\n${await runProcess(command, argv, this.root, signal)}`;
    } finally {
      lifecycle.abort();
      await bridge.shutdown();
      await Deno.remove(join(dir, "mcp.ts"));
    }
  }
}
