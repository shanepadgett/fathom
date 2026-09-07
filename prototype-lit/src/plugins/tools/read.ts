import { definePlugin } from "../../kernel/plugin.ts";
import { bounded, schema, stringArg } from "./arguments.ts";
export default definePlugin({
  id: "tool-read",
  apiVersion: 1,
  requires: ["tools", "workspace"],
  activate(ctx) {
    const workspace = ctx.get("workspace");
    ctx.effect(() =>
      ctx.get("tools").register({
        name: "read",
        description:
          "Read a UTF-8 text file. Paths are relative to the workspace or absolute. Output limited to 32,000 characters.",
        parameters: schema({ path: "File path" }),
        async execute(args, signal) {
          signal.throwIfAborted();
          const file = await Deno.open(
            workspace.resolve(stringArg(args, "path")),
          );
          try {
            const buffer = new Uint8Array(128_000);
            let n = 0;
            while (n < buffer.length) {
              signal.throwIfAborted();
              const count = await file.read(buffer.subarray(n));
              if (count === null) break;
              n += count;
            }
            return bounded(
              new TextDecoder().decode(buffer.subarray(0, n ?? 0)),
            ) + (n === buffer.length ? "\n[file read capped at 128KB]" : "");
          } finally {
            file.close();
          }
        },
      })
    );
  },
});
