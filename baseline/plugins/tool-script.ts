/** script tool. Saves and runs deno/node/python/bash through subprocess. */
import { join } from "@std/path";
import { Type } from "typebox";

import { definePlugin } from "../sdk.ts";

type Interpreter = keyof typeof interpreters;

const interpreters = {
  deno: { command: "deno", args: ["run", "-A"], extension: "ts" },
  node: { command: "node", args: [] as string[], extension: "mjs" },
  python3: { command: "python3", args: [] as string[], extension: "py" },
  bash: { command: "/bin/bash", args: [] as string[], extension: "sh" },
} as const;

export default definePlugin({
  name: "tool-script",
  inject: ["tools", "workspace", "subprocess"],
  apply(ctx) {
    ctx.effect(() =>
      ctx.tools.register({
        name: "script",
        description:
          "Save and run a multi-line script. Existing scripts can be read or patched by ID.",
        parameters: Type.Object({
          action: Type.Union([Type.Literal("run"), Type.Literal("read"), Type.Literal("patch")]),
          interpreter: Type.Optional(
            Type.Union([
              Type.Literal("deno"),
              Type.Literal("node"),
              Type.Literal("python3"),
              Type.Literal("bash"),
            ]),
          ),
          id: Type.Optional(Type.String({ pattern: "^[a-zA-Z0-9_-]{1,100}$" })),
          code: Type.Optional(Type.String({ maxLength: 1_000_000 })),
          oldText: Type.Optional(Type.String()),
          newText: Type.Optional(Type.String()),
          timeoutMs: Type.Optional(Type.Integer({ minimum: 100, maximum: 3_600_000 })),
        }),
        async execute(args, cycle) {
          const id = String(args.id ?? crypto.randomUUID());
          const folder = join(ctx.workspace.dataDir, "scratch", cycle.sessionId);
          const metadata = join(folder, `${id}.json`);
          let interpreter: Interpreter = (args.interpreter as Interpreter) ?? "deno";
          let code: string;
          if (args.code !== undefined) code = String(args.code);
          else {
            const saved = JSON.parse(await Deno.readTextFile(metadata)) as {
              interpreter: Interpreter;
              path: string;
            };
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
          const spec = interpreters[interpreter];
          if (!spec) throw new Error("Unknown interpreter");
          const path = join(folder, `${id}.${spec.extension}`);
          await Deno.mkdir(folder, { recursive: true, mode: 0o700 });
          await Deno.writeTextFile(path, code);
          await Deno.writeTextFile(metadata, JSON.stringify({ interpreter, path }));
          const output = await ctx.subprocess.run({
            command: spec.command,
            args: [...spec.args, path],
            cwd: ctx.workspace.root,
            signal: cycle.signal,
            timeoutMs: Number(args.timeoutMs ?? 60_000),
          });
          const preview =
            output.text.length > 100_000
              ? `${output.text.slice(0, 50_000)}\n[Output truncated]\n${output.text.slice(-50_000)}`
              : output.text;
          const body = output.code === 0 ? preview : `${preview}\nexit ${output.code}`;
          return `script=${id}\n${body}`;
        },
      }),
    );
  },
});
