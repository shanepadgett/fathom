import { definePlugin } from "../../kernel/plugin.ts";
import { schema, stringArg } from "./arguments.ts";
export default definePlugin({
  id: "tool-edit",
  apiVersion: 1,
  requires: ["tools", "workspace"],
  activate(ctx) {
    const workspace = ctx.get("workspace");
    ctx.effect(() =>
      ctx.get("tools").register({
        name: "edit",
        description:
          "Replace exactly one occurrence of oldText with newText. Rejects missing, empty, or ambiguous matches.",
        parameters: schema({
          path: "File path",
          oldText: "Exact unique text to replace",
          newText: "Replacement text",
        }),
        async execute(args, signal) {
          const path = workspace.resolve(stringArg(args, "path"));
          const oldText = stringArg(args, "oldText");
          const newText = stringArg(args, "newText");
          if (!oldText) throw new Error("oldText cannot be empty");
          const content = await Deno.readTextFile(path, { signal });
          const first = content.indexOf(oldText);
          if (
            first < 0 || content.indexOf(oldText, first + 1) >= 0
          ) {
            throw new Error(
              "oldText must match exactly once; read the file and provide more context",
            );
          }
          await Deno.writeTextFile(
            path,
            content.slice(0, first) + newText +
              content.slice(first + oldText.length),
            { signal },
          );
          return `Edited ${path}`;
        },
      })
    );
  },
});
