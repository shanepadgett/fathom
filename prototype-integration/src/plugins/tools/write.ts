import { dirname } from "node:path";
import { definePlugin } from "../../kernel/plugin.ts";
import { schema, stringArg } from "./arguments.ts";
export default definePlugin({
  id: "tool-write",
  apiVersion: 1,
  requires: ["tools", "workspace", "workbench"],
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
          const open = ctx.get("workbench").lsp.documents.get(path);
          if (open && open.text !== open.saved) {
            throw new Error(
              "File has unsaved editor changes. Use editor_read and versioned editor_edit.",
            );
          }
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
