import { dirname } from "node:path";
import { definePlugin } from "../../kernel/plugin.ts";
import { schema, stringArg } from "./arguments.ts";
export default definePlugin({
  id: "tool-write",
  apiVersion: 1,
  requires: ["tools", "workspace"],
  activate(ctx) {
    const workspace = ctx.get("workspace");
    ctx.effect(() =>
      ctx.get("tools").register({
        name: "write",
        description:
          "Create or overwrite a UTF-8 text file. Creates missing parent directories.",
        parameters: schema({
          path: "File path",
          content: "Complete file content",
        }),
        async execute(args, signal) {
          const path = workspace.resolve(stringArg(args, "path"));
          const content = stringArg(args, "content");
          signal.throwIfAborted();
          await Deno.mkdir(dirname(path), { recursive: true });
          await Deno.writeTextFile(path, content, { signal });
          return `Wrote ${
            new TextEncoder().encode(content).length
          } bytes to ${path}`;
        },
      })
    );
  },
});
