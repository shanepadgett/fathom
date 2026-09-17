/** bash tool. Runs a bounded command in the workspace through subprocess. */
import { dirname, join } from "@std/path";
import { Type } from "typebox";

import { definePlugin } from "../sdk.ts";

export default definePlugin({
  name: "tool-bash",
  inject: ["tools", "subprocess", "workspace"],
  apply(ctx) {
    ctx.effect(() =>
      ctx.tools.register({
        name: "bash",
        description:
          "Run a bounded shell command in the workspace. Cap verbose output. Cancellation kills the process.",
        parameters: Type.Object({
          command: Type.String(),
          timeoutMs: Type.Optional(Type.Integer({ minimum: 100, maximum: 3_600_000 })),
        }),
        async execute(args, cycle) {
          const logPath = join(
            ctx.workspace.dataDir,
            "scratch",
            cycle.sessionId,
            `${crypto.randomUUID()}.log`,
          );
          await Deno.mkdir(dirname(logPath), { recursive: true, mode: 0o700 });
          const output = await ctx.subprocess.run({
            command: "/bin/bash",
            args: ["-c", String(args.command)],
            cwd: ctx.workspace.root,
            signal: cycle.signal,
            timeoutMs: Number(args.timeoutMs ?? 60_000),
          });
          await Deno.writeTextFile(logPath, output.text);
          const preview =
            output.text.length > 100_000
              ? `${output.text.slice(0, 50_000)}\n[Full output: ${output.text.length} bytes saved to ${logPath}]\n${output.text.slice(-50_000)}`
              : output.text;
          return output.code === 0 ? preview : `${preview}\nexit ${output.code}`;
        },
      }),
    );
  },
});
