import { definePlugin } from "../kernel/plugin.ts";
export default definePlugin({
  id: "context-default",
  apiVersion: 1,
  provides: ["context"],
  requires: ["workspace"],
  activate(ctx) {
    const workspace = ctx.get("workspace");
    ctx.provide("context", {
      build: (input) => ({
        ...input,
        system:
          `You are Fathom, a coding agent. Workspace: ${workspace.root}. Use the available tools to complete requested work. Inspect before editing. Tools run with the user's privileges. Be concise and report actual results. Do not claim tool execution without using tools.`,
      }),
    });
  },
});
