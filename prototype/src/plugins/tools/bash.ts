import { definePlugin } from "../../kernel/plugin.ts";
import { schema, stringArg } from "./arguments.ts";
import { runBash } from "./process.ts";
export default definePlugin({
  id: "tool-bash",
  apiVersion: 1,
  requires: ["tools", "workspace"],
  activate(ctx) {
    const workspace = ctx.get("workspace");
    ctx.effect(() =>
      ctx.get("tools").register({
        name: "bash",
        description:
          "Run bash in the workspace. Each call starts a fresh shell. 60 second timeout; output capped. Nonzero exits are reported.",
        parameters: schema({ command: "Bash command" }),
        execute: (args, signal) =>
          runBash(stringArg(args, "command"), workspace.root, signal),
      })
    );
  },
});
