import { resolve } from "node:path";
import { Type } from "typebox";
import { definePlugin } from "../kernel/plugin.ts";
import type { ToolRegistry } from "../contracts/tools.ts";
import { LanguageService } from "./lsp.ts";
import { McpService } from "./mcp.ts";
import { TerminalService } from "./terminal.ts";
import { Approvals } from "./approvals.ts";
import { Scripts } from "./scripts.ts";

export class Workbench {
  readonly lsp: LanguageService;
  readonly mcp = new McpService();
  readonly terminal = new TerminalService();
  readonly approvals = new Approvals();
  readonly scripts: Scripts;
  readonly abort = new AbortController();
  readonly jobs = new Map<
    string,
    {
      id: string;
      tool: string;
      status: string;
      result?: string;
      abort: AbortController;
      work: Promise<void>;
    }
  >();
  private unregister: (() => void)[] = [];
  private mcpUnregister: (() => void)[] = [];
  constructor(readonly root: string, readonly tools: ToolRegistry) {
    this.lsp = new LanguageService(root);
    this.scripts = new Scripts(
      root,
      resolve(
        Deno.env.get("HOME") ?? root,
        ".fathom/prototype-integration/scratch",
      ),
      this.mcp,
      this.approvals,
    );
  }
  async init() {
    await this.lsp.init();
    const register = (
      name: string,
      description: string,
      parameters: object,
      execute: (
        args: Record<string, unknown>,
        signal: AbortSignal,
      ) => Promise<string>,
    ) => {
      this.unregister.push(
        this.tools.register({
          name,
          description,
          parameters: { ...parameters },
          execute,
        }),
      );
    };
    register(
      "diagnostics",
      "Read the same Deno LSP diagnostics shown in Monaco, including unsaved text. pending=true means analysis has not finished.",
      Type.Object({ path: Type.String() }),
      async (args) => {
        await this.lsp.refresh();
        return JSON.stringify(await this.lsp.diagnostics(String(args.path)));
      },
    );
    register(
      "editor_read",
      "Read the editor document, unsaved text and version. Use editor_edit to change it safely.",
      Type.Object({ path: Type.String() }),
      async (args) => JSON.stringify(await this.lsp.open(String(args.path))),
    );
    register(
      "editor_edit",
      "Replace a unique string in the shared editor buffer at the version from editor_read. Save the result and update LSP diagnostics.",
      Type.Object({
        path: Type.String(),
        version: Type.Integer(),
        oldText: Type.String(),
        newText: Type.String(),
      }),
      async (args) => {
        const doc = await this.lsp.open(String(args.path));
        const old = String(args.oldText);
        if (!old || doc.text.split(old).length !== 2) {
          throw new Error(
            "oldText must match exactly once",
          );
        }
        await this.lsp.change(
          doc.path,
          doc.text.replace(old, String(args.newText)),
          Number(args.version),
        );
        await this.lsp.save(doc.path, doc.version);
        return JSON.stringify(await this.lsp.diagnostics(doc.path));
      },
    );
    register(
      "script",
      "Run a saved script after user approval. Deno scripts can import { mcp } from 'fathom:mcp' and call mcp.tool_name(args). Patch a previous script using scriptId, oldText, newText.",
      Type.Object({
        runtime: Type.Optional(Type.String()),
        code: Type.Optional(Type.String()),
        scriptId: Type.Optional(Type.String()),
        oldText: Type.Optional(Type.String()),
        newText: Type.Optional(Type.String()),
      }),
      (args, signal) => this.scripts.run(args, signal),
    );
    register(
      "search_tools",
      "Search tools connected through MCP. All matching tools are callable by their mcp_ prefixed names in this prototype.",
      Type.Object({ query: Type.String() }),
      (args) =>
        Promise.resolve(JSON.stringify(
          this.mcp.tools.filter((t) =>
            `${t.name} ${t.description}`.toLowerCase().includes(
              String(args.query).toLowerCase(),
            )
          ),
        )),
    );
  }
  async connect(args: { command?: string; args?: string[]; url?: string }) {
    if ([...this.jobs.values()].some((j) => j.status === "running")) {
      throw new Error("Wait for active jobs before reconnecting MCP");
    }
    for (const remove of this.mcpUnregister.splice(0)) remove();
    const tools = await this.mcp.connect(args);
    for (const tool of tools) {
      this.mcpUnregister.push(this.tools.register({
        name: `mcp_${tool.name}`,
        description: tool.description ?? tool.name,
        parameters: tool.inputSchema,
        execute: async (args, signal) => {
          await this.approvals.request(
            `MCP tool ${tool.name}\n${JSON.stringify(args, null, 2)}`,
            signal,
          );
          return JSON.stringify(await this.mcp.call(tool.name, args, signal));
        },
      }));
    }
    return tools;
  }
  async state() {
    await this.lsp.refresh();
    return {
      documents: [...this.lsp.documents.values()],
      terminal: this.terminal.snapshot(),
      approvals: this.approvals.list(),
      mcpTools: this.mcp.tools,
      jobs: [...this.jobs.values()].map(({ id, tool, status, result }) => ({
        id,
        tool,
        status,
        result,
      })),
    };
  }
  async command(action: string, args: Record<string, unknown>) {
    switch (action) {
      case "open":
        return await this.lsp.open(String(args.path));
      case "change":
        return await this.lsp.change(
          String(args.path),
          String(args.text),
          Number(args.version),
        );
      case "save":
        return await this.lsp.save(String(args.path), Number(args.version));
      case "approve":
        this.approvals.decide(String(args.id), args.allow === true);
        break;
      case "connect":
        return await this.connect(
          args as { command?: string; args?: string[]; url?: string },
        );
      case "connect-fixture": {
        const source = new URL("../../examples/mcp-server.ts", import.meta.url);
        const dir = await Deno.makeTempDir({ prefix: "fathom-mcp-" });
        const path = resolve(dir, "server.ts");
        await Deno.writeTextFile(path, await Deno.readTextFile(source));
        try {
          return await this.connect({
            command: Deno.env.get("FATHOM_DENO") ?? "deno",
            args: ["run", "-A", "--no-config", path],
          });
        } finally {
          await Deno.remove(dir, { recursive: true });
        }
      }
      case "terminal-start":
        await this.terminal.start(this.root);
        break;
      case "terminal-write":
        this.terminal.write(String(args.data));
        break;
      case "terminal-resize":
        this.terminal.resize(Number(args.cols), Number(args.rows));
        break;
      case "terminal-stop":
        this.terminal.stop();
        break;
      case "cancel-job":
        this.jobs.get(String(args.id))?.abort.abort();
        break;
      case "tool": {
        const id = crypto.randomUUID();
        const abort = new AbortController();
        const job = {
          id,
          tool: String(args.name),
          status: "running",
          result: "",
          abort,
          work: Promise.resolve(),
        };
        this.jobs.set(id, job);
        job.work = this.tools.execute(
          job.tool,
          args.args as Record<string, unknown> ?? {},
          AbortSignal.any([abort.signal, this.abort.signal]),
        )
          .then((result) => {
            job.status = "done";
            job.result = result;
          })
          .catch((error) => {
            job.status = "error";
            job.result = String(error);
          });
        return { id };
      }
      default:
        throw new Error(`Unknown workbench action: ${action}`);
    }
    return { ok: true };
  }
  async dispose() {
    this.abort.abort();
    this.approvals.dispose();
    this.terminal.stop();
    await Promise.all([...this.jobs.values()].map((j) => j.work));
    for (const remove of [...this.unregister, ...this.mcpUnregister]) remove();
    await this.mcp.dispose();
    await this.lsp.dispose();
  }
}

export default definePlugin({
  id: "integration-workbench",
  apiVersion: 1,
  provides: ["workbench"],
  requires: ["workspace", "tools"],
  async activate(ctx) {
    const workbench = new Workbench(
      ctx.get("workspace").root,
      ctx.get("tools"),
    );
    ctx.effect(() => () => workbench.dispose());
    await workbench.init();
    ctx.provide("workbench", workbench);
  },
});
