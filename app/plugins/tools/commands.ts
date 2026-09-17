import { join } from "node:path";

import { Type } from "typebox";

import { atomicWrite } from "../../kernel/files.ts";
import { denoExecutable } from "../../kernel/runtime.ts";
import { definePlugin } from "../../sdk/mod.ts";
import { mcpBridge } from "./mcp-bridge.ts";
import { runProcess } from "./process.ts";

export default definePlugin({
  id: "fathom:commands",
  apiVersion: 1,
  backend: {
    requires: ["tools", "workspace", "terminal"],
    activate(ctx) {
      const tools = ctx.get("tools"),
        workspace = ctx.get("workspace");
      const registrations = [
        tools.register({
          name: "bash",
          description:
            "Run a bounded shell command in the workspace. Cap verbose output using head or filters. Full output is saved outside the repository. Cancellation terminates the process group. Use background: true for a development server; manage the returned terminal with pty.",
          parameters: Type.Object({
            command: Type.String(),
            background: Type.Optional(Type.Boolean()),
            timeoutMs: Type.Optional(Type.Integer({ minimum: 100, maximum: 3_600_000 })),
          }),
          execute: async (args, context) => {
            if (args.background === true) {
              context.signal.throwIfAborted();
              const terminal = await ctx
                .get("terminal")
                .start(context.sessionId, String(args.command));
              if (context.signal.aborted) {
                ctx.get("terminal").stop(terminal.id);
                context.signal.throwIfAborted();
              }
              return JSON.stringify(terminal);
            }
            return runProcess({
              command: "/bin/bash",
              args: ["-c", String(args.command)],
              cwd: workspace.root,
              signal: context.signal,
              timeoutMs: Number(args.timeoutMs ?? 60_000),
              logPath: join(
                workspace.dataDir,
                "scratch",
                context.sessionId,
                `output-${context.callId}.log`,
              ),
              report: context.report,
            });
          },
        }),
        tools.register({
          name: "script",
          description:
            "Save and run a multi-line script. Existing scripts can be read or patched by ID. Every execution is reviewed. Filter data inside scripts and return concise output.",
          parameters: Type.Object({
            action: Type.Union([Type.Literal("run"), Type.Literal("read"), Type.Literal("patch")]),
            interpreter: Type.Optional(
              Type.Union([
                Type.Literal("deno"),
                Type.Literal("node"),
                Type.Literal("python3"),
                Type.Literal("bash"),
                Type.Literal("ruby"),
                Type.Literal("perl"),
              ]),
            ),
            id: Type.Optional(Type.String({ pattern: "^[a-zA-Z0-9_-]{1,100}$" })),
            code: Type.Optional(Type.String({ maxLength: 1_000_000 })),
            oldText: Type.Optional(Type.String()),
            newText: Type.Optional(Type.String()),
            timeoutMs: Type.Optional(Type.Integer({ minimum: 100, maximum: 3_600_000 })),
          }),
          async execute(args, context) {
            const id = String(args.id ?? crypto.randomUUID());
            const folder = join(workspace.dataDir, "scratch", context.sessionId);
            const metadata = join(folder, `${id}.json`);
            let interpreter = String(args.interpreter ?? "deno"),
              code: string;
            if (args.code !== undefined) code = String(args.code);
            else {
              const saved = JSON.parse(await Deno.readTextFile(metadata));
              interpreter = saved.interpreter;
              code = await Deno.readTextFile(saved.path);
            }
            if (args.action === "read") return `script=${id}\n${code}`;
            if (args.action === "patch") {
              const old = String(args.oldText ?? "");
              if (!old || code.split(old).length !== 2) {
                throw new Error("Patch text must match exactly once");
              }
              code = code.replace(old, String(args.newText ?? ""));
            }
            const extension: Record<string, string> = {
              deno: "ts",
              node: "mjs",
              python3: "py",
              bash: "sh",
              ruby: "rb",
              perl: "pl",
            };
            const path = join(folder, `${id}.${extension[interpreter]}`);
            await atomicWrite(path, code);
            await atomicWrite(metadata, JSON.stringify({ interpreter, path }));
            const bridge =
              interpreter === "deno"
                ? await mcpBridge(join(folder, context.callId), tools, context)
                : undefined;
            try {
              const commandArgs =
                interpreter === "deno" ? ["run", "-A", "--config", bridge!.config, path] : [path];
              const result = await runProcess({
                command: interpreter === "deno" ? denoExecutable() : interpreter,
                args: commandArgs,
                cwd: workspace.root,
                signal: context.signal,
                timeoutMs: Number(args.timeoutMs ?? 60_000),
                logPath: join(folder, `output-${context.callId}.log`),
                env: bridge ? { FATHOM_MCP_TOKEN: bridge.token } : undefined,
                report: context.report,
              });
              return `script=${id}\n${result}`;
            } finally {
              await bridge?.close();
            }
          },
        }),
      ];
      ctx.cordis.on("tool:before", async (input) => {
        if (input.name !== "script" || input.args.action === "read") return;
        const args = input.args;
        if (args.code === undefined && args.id) {
          const metadata = JSON.parse(
            await Deno.readTextFile(
              join(workspace.dataDir, "scratch", input.sessionId, `${args.id}.json`),
            ),
          );
          args.interpreter = metadata.interpreter;
          args.code = await Deno.readTextFile(metadata.path);
        }
        if (args.action === "patch") {
          const code = String(args.code ?? ""),
            old = String(args.oldText ?? "");
          if (!old || code.split(old).length !== 2) {
            throw new Error("Patch text must match exactly once");
          }
          args.code = code.replace(old, String(args.newText ?? ""));
          args.action = "run";
        }
      });
      ctx.effect(() => () => {
        for (const dispose of registrations) dispose();
      });
    },
  },
});
