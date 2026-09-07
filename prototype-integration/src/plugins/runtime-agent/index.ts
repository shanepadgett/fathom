import { definePlugin } from "../../kernel/plugin.ts";
import { runLoop } from "./loop.ts";
export default definePlugin({
  id: "runtime-agent",
  apiVersion: 1,
  provides: ["runtime"],
  requires: ["model", "sessions", "tools", "context"],
  activate(ctx) {
    const deps = {
      model: ctx.get("model"),
      sessions: ctx.get("sessions"),
      tools: ctx.get("tools"),
      context: ctx.get("context"),
    };
    ctx.provide("runtime", {
      id: "agent",
      run: (text, signal) => runLoop(text, signal, deps),
    });
  },
});
